/* BEHIX — in-person delivery picker: available days + time slots with the
   remaining capacity. Used by the order wizard and the customer panel.
   BX.deliveryPicker(el, { days, value: {date, slot}, onChange }) */
(function () {
  "use strict";
  const BX = window.BX;
  const cache = {};

  async function load(days) {
    if (!cache[days]) cache[days] = BX.api("delivery.slots", { days });
    try { return await cache[days]; } catch (e) { delete cache[days]; throw e; }
  }

  BX.deliveryPicker = async function (el, opts = {}) {
    const { icon, esc, faDigits } = BX;
    let value = opts.value && opts.value.date ? { ...opts.value } : null;
    el.innerHTML = `<div class="dlv-skel skeleton"></div>`;
    let data;
    try { data = await load(Math.max(0, opts.days || 0)); } catch (e) { el.innerHTML = `<p class="bad small">${esc(e.message)}</p>`; return; }
    if (!data.enabled || !data.days.length) {
      el.innerHTML = `<div class="dlv-empty">${icon("calendar")}<span>${data.enabled ? "در بازه پیش رو زمان خالی برای تحویل وجود ندارد؛ لطفاً با پشتیبانی هماهنگ کنید." : "تحویل حضوری فعلاً غیرفعال است."}</span></div>`;
      return;
    }
    // a saved choice that is no longer offered (moved lead time, filled up) is dropped
    if (value) {
      const d0 = data.days.find((d) => d.date === value.date);
      const s0 = d0 && d0.slots.find((s) => s.id === value.slot);
      if (!s0 || (!s0.left && !opts.keepFull)) { value = null; opts.onInvalid && opts.onInvalid(); }
    }
    let day = (value && data.days.find((d) => d.date === value.date)) || data.days.find((d) => !d.full) || data.days[0];

    const draw = () => {
      el.innerHTML = `
        ${data.place || data.note ? `<p class="dlv-info">${icon("info")}<span>${data.place ? `<b>محل تحویل:</b> ${esc(data.place)}<br>` : ""}${esc(data.note || "")}</span></p>` : ""}
        <div class="dlv-days" role="listbox" aria-label="روز تحویل">${data.days.map((d) => `
          <button type="button" class="dlv-day ${d.date === day.date ? "is-on" : ""} ${d.full ? "is-full" : ""}" data-day="${d.date}" ${d.full ? "disabled" : ""} role="option" aria-selected="${d.date === day.date}">
            <small>${esc(d.wd)}</small><b>${d.day}</b><small>${esc(d.month)}</small>${d.full ? '<i>تکمیل</i>' : ""}
          </button>`).join("")}</div>
        <div class="dlv-slots">${day.slots.map((s) => {
          const on = value && value.date === day.date && value.slot === s.id;
          const pct = s.cap ? Math.round(((s.cap - s.left) / s.cap) * 100) : 100;
          return `<button type="button" class="dlv-slot ${on ? "is-on" : ""}" data-slot="${esc(s.id)}" ${s.left ? "" : "disabled"}>
            <span class="dlv-slot-t">${icon("clock")}<b>${esc(s.label)}</b><small>${esc(s.time)}</small></span>
            <span class="dlv-cap"><i style="width:${pct}%"></i></span>
            <small class="${s.left ? (s.left <= 1 ? "warn" : "ok") : "bad"}">${s.left ? `${faDigits(s.left)} جای خالی` : "ظرفیت تکمیل"}</small>
          </button>`;
        }).join("")}</div>
        <p class="dlv-pick">${value ? `${icon("check-circle")} زمان انتخابی: <b>${esc(value.label || "")}</b>` : `${icon("calendar")} یک روز و یک بازه زمانی انتخاب کنید.`}</p>`;
      el.querySelector(".dlv-day.is-on")?.scrollIntoView({ block: "nearest", inline: "center" });
    };
    el.onclick = (e) => {
      const d = e.target.closest("[data-day]");
      if (d && !d.disabled) { day = data.days.find((x) => x.date === d.dataset.day); return draw(); }
      const s = e.target.closest("[data-slot]");
      if (s && !s.disabled) {
        const slot = day.slots.find((x) => x.id === s.dataset.slot);
        value = { date: day.date, slot: slot.id, label: `${day.label}، ${slot.label} (${slot.time})` };
        draw();
        opts.onChange && opts.onChange(value);
      }
    };
    draw();
  };
  BX.deliveryPicker.reset = () => { for (const k in cache) delete cache[k]; };

  // Modal for choosing/changing the time of an existing order (panel)
  BX.deliveryModal = function ({ title, days = 0, value, onSave }) {
    let picked = null;
    BX.modal({
      title: title || "انتخاب زمان تحویل", wide: true,
      body: `<div data-dlv-modal></div>`,
      onOpen: (w) => { BX.deliveryPicker.reset(); BX.deliveryPicker(w.querySelector("[data-dlv-modal]"), { days, value, onChange: (v) => (picked = v) }); },
      actions: [{ label: "انصراف" }, { label: "ثبت زمان", primary: true, onClick: () => {
        if (!picked) { BX.toast("یک بازه زمانی انتخاب کنید.", "bad"); return false; }
        onSave(picked);
      } }],
    });
  };
})();
