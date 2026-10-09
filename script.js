/* SmartWatt – Energy Bill Calculator
   Plain HTML + CSS + JS. No build step needed. */
(() => {
'use strict';

/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const toNum = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

const STORE_KEY = 'smartwatt.v2';
const CO2_FACTOR = 0.6; // kg CO2 per kWh – rough grid estimate
const ROOMS = ['bedroom', 'living', 'kitchen', 'bathroom', 'other'];

const CURRENCIES = {
  BDT: { sym: '৳', rate: 8.5, solar: 70000, flag: 'BD' },
  INR: { sym: '₹', rate: 7.5, solar: 55000, flag: 'IN' },
  USD: { sym: '$', rate: 0.15, solar: 1000, flag: 'US' },
  GBP: { sym: '£', rate: 0.28, solar: 1500, flag: 'UK' },
  EUR: { sym: '€', rate: 0.20, solar: 1300, flag: 'EU' },
};

const DEFAULT_SLABS = () => ([
  { upto: 75, rate: 5.26 },
  { upto: 200, rate: 7.20 },
  { upto: 300, rate: 7.59 },
  { upto: 400, rate: 8.02 },
  { upto: 600, rate: 12.67 },
  { upto: null, rate: 14.61 },
]);

/* ================= appliance presets ================= */
const PRESETS = [
  // cooling
  { id: 'fan', g: 'cooling', icon: '🌀', w: 75, h: 8, r: 'bedroom', n: { en: 'Ceiling Fan', bn: 'সিলিং ফ্যান' } },
  { id: 'cooler', g: 'cooling', icon: '💨', w: 150, h: 6, r: 'living', n: { en: 'Air Cooler', bn: 'এয়ার কুলার' } },
  { id: 'ac1', g: 'cooling', icon: '❄️', w: 1000, h: 8, duty: 60, r: 'bedroom', n: { en: 'AC 1 Ton', bn: 'এসি ১ টন' } },
  { id: 'ac15', g: 'cooling', icon: '❄️', w: 1400, h: 8, duty: 60, r: 'bedroom', n: { en: 'AC 1.5 Ton', bn: 'এসি ১.৫ টন' } },
  { id: 'ac2', g: 'cooling', icon: '❄️', w: 1900, h: 8, duty: 60, r: 'living', n: { en: 'AC 2 Ton', bn: 'এসি ২ টন' } },
  { id: 'acinv', g: 'cooling', icon: '❄️', w: 900, h: 8, duty: 60, r: 'bedroom', n: { en: 'Inverter AC 1.5 Ton', bn: 'ইনভার্টার এসি ১.৫ টন' } },
  // lighting
  { id: 'led', g: 'lighting', icon: '💡', w: 9, h: 6, r: 'living', n: { en: 'LED Bulb (9W)', bn: 'এলইডি বাল্ব (৯ ওয়াট)' } },
  { id: 'tube', g: 'lighting', icon: '💡', w: 18, h: 6, r: 'living', n: { en: 'LED Tube Light (18W)', bn: 'এলইডি টিউব লাইট (১৮ ওয়াট)' } },
  { id: 'cfl', g: 'lighting', icon: '💡', w: 15, h: 6, r: 'living', n: { en: 'CFL Bulb (15W)', bn: 'সিএফএল বাল্ব (১৫ ওয়াট)' } },
  { id: 'inc', g: 'lighting', icon: '💡', w: 60, h: 6, r: 'living', n: { en: 'Incandescent Bulb (60W)', bn: 'ইনক্যান্ডেসেন্ট বাল্ব (৬০ ওয়াট)' } },
  // kitchen
  { id: 'fridge', g: 'kitchen', icon: '🧊', w: 150, h: 24, duty: 40, r: 'kitchen', n: { en: 'Refrigerator', bn: 'ফ্রিজ' } },
  { id: 'micro', g: 'kitchen', icon: '🍲', w: 1200, h: 0.5, r: 'kitchen', n: { en: 'Microwave Oven', bn: 'মাইক্রোওয়েভ ওভেন' } },
  { id: 'kettle', g: 'kitchen', icon: '☕', w: 1500, h: 0.3, r: 'kitchen', n: { en: 'Electric Kettle', bn: 'ইলেকট্রিক কেটলি' } },
  { id: 'rice', g: 'kitchen', icon: '🍚', w: 700, h: 1, r: 'kitchen', n: { en: 'Rice Cooker', bn: 'রাইস কুকার' } },
  { id: 'blender', g: 'kitchen', icon: '🥤', w: 400, h: 0.2, r: 'kitchen', n: { en: 'Blender', bn: 'ব্লেন্ডার' } },
  { id: 'induction', g: 'kitchen', icon: '🔥', w: 1800, h: 1.5, r: 'kitchen', n: { en: 'Induction Cooker', bn: 'ইন্ডাকশন কুকার' } },
  // entertainment & office
  { id: 'tv32', g: 'ent', icon: '📺', w: 50, h: 5, r: 'living', n: { en: 'LED TV 32"', bn: 'এলইডি টিভি ৩২"' } },
  { id: 'tv55', g: 'ent', icon: '📺', w: 100, h: 5, r: 'living', n: { en: 'LED TV 55"', bn: 'এলইডি টিভি ৫৫"' } },
  { id: 'pc', g: 'ent', icon: '🖥️', w: 200, h: 6, r: 'bedroom', n: { en: 'Desktop Computer', bn: 'ডেস্কটপ কম্পিউটার' } },
  { id: 'laptop', g: 'ent', icon: '💻', w: 60, h: 6, r: 'bedroom', n: { en: 'Laptop', bn: 'ল্যাপটপ' } },
  { id: 'router', g: 'ent', icon: '📶', w: 12, h: 24, r: 'living', n: { en: 'Wi-Fi Router', bn: 'ওয়াই-ফাই রাউটার' } },
  { id: 'charger', g: 'ent', icon: '🔋', w: 10, h: 3, r: 'bedroom', n: { en: 'Phone Charger', bn: 'ফোন চার্জার' } },
  { id: 'console', g: 'ent', icon: '🎮', w: 150, h: 2, r: 'living', n: { en: 'Gaming Console', bn: 'গেমিং কনসোল' } },
  // household
  { id: 'washer', g: 'house', icon: '🧺', w: 500, h: 1, d: 12, r: 'bathroom', n: { en: 'Washing Machine', bn: 'ওয়াশিং মেশিন' } },
  { id: 'iron', g: 'house', icon: '👔', w: 1000, h: 0.5, d: 12, r: 'bedroom', n: { en: 'Electric Iron', bn: 'ইলেকট্রিক ইস্ত্রি' } },
  { id: 'pump', g: 'house', icon: '🚰', w: 750, h: 1, r: 'other', n: { en: 'Water Pump', bn: 'পানির পাম্প' } },
  { id: 'geyser', g: 'house', icon: '🚿', w: 2000, h: 0.5, r: 'bathroom', n: { en: 'Water Heater (Geyser)', bn: 'গিজার' } },
  { id: 'vacuum', g: 'house', icon: '🧹', w: 1000, h: 0.3, d: 8, r: 'living', n: { en: 'Vacuum Cleaner', bn: 'ভ্যাকুয়াম ক্লিনার' } },
];
const PRESET_GROUPS = ['cooling', 'lighting', 'kitchen', 'ent', 'house'];

/* ================= translations ================= */
const I18N = {
  en: {
    skip: `Skip to calculator`, nav_calc: `Calculator`, nav_analysis: `Analysis`, nav_tools: `Tools`, nav_tips: `Tips`, nav_faq: `FAQ`, nav_about: `About`,
    hero_badge: `ECE Project · Energy Bill Calculator`,
    hero_title: `Know your electricity bill <span>before it arrives</span>`,
    hero_sub: `Add your appliances, pick your tariff and get an instant monthly estimate with charts, savings tips and solar insights.`,
    hero_cta: `Start calculating`, hero_install: `Install app`,
    settings: `Unit Rate Settings`, currency: `Currency`, mode_flat: `Flat rate`, mode_slab: `Slab (tiered)`,
    unit_price: `Unit price (per kWh)`,
    slab_hint: `Tiered tariff: each block of units is charged at its own rate. Defaults are sample residential rates — please check your distributor's current tariff.`,
    slab_reset: `Reset to default slabs`, vat: `VAT (%)`, fixed: `Fixed / demand charge`, billing_days: `Billing days`, budget: `Monthly budget (optional)`,
    add_appliance: `Add Appliance`, edit_appliance: `Edit Appliance`, choose_preset: `Choose appliance`, app_name: `Appliance Name`, or_custom: `(or enter custom)`, ph_name: `e.g. Ceiling Fan`,
    wattage: `Wattage (W)`, quantity: `Quantity`, hours: `Daily Usage (hours/day)`, days: `Days used / month`, duty: `Duty cycle (%)`, room: `Room`,
    duty_hint: `Duty cycle: how much of the time it really draws full power (e.g. a fridge ≈ 40%, an AC ≈ 60%).`,
    add_to_bill: `+ Add to Bill`, save_changes: `Save changes`, cancel: `Cancel`,
    formula: `<b>Monthly kWh</b> = (Wattage × Qty × Hours/day × Days × Duty%) ÷ 1000<br><b>Monthly Cost</b> = Monthly kWh × Unit Price`,
    est_bill: `Estimated Monthly Bill`, total_units: `Total Units`, per_day: `Per Day`, daily_cost: `Daily Cost`, yearly: `Yearly Estimate`, co2: `CO₂ / month`, avg_rate: `Avg. rate / kWh`,
    breakdown: `Bill breakdown`, export_csv: `Export CSV`, print: `Print`, share: `Share link`,
    your_appliances: `Your Appliances`, sort_by: `Sort`, sort_cost: `Highest cost`, sort_added: `Recently added`, sort_name: `Name (A–Z)`, clear_all: `Clear All`,
    empty_title: `No appliances yet`, empty_text: `Choose an appliance or enter a custom one, then tap “Add to Bill”.`,
    analysis: `Usage Analysis`, chart_app: `Cost by appliance`, chart_empty: `Add appliances to see the chart.`, chart_room: `Energy by room (kWh)`, insights: `Smart insights`,
    tools_title: `More Tools`, meter_title: `Meter Reading Calculator`,
    meter_hint: `Enter your previous and current meter readings. Uses the tariff, VAT and charges set above.`,
    prev_reading: `Previous reading`, curr_reading: `Current reading`,
    solar_title: `Solar Savings Estimator`,
    solar_hint: `Rough estimate of how much a rooftop solar system could cut your bill. Costs are editable assumptions.`,
    sys_size: `System size (kW)`, sun_hours: `Peak sun hours / day`, perf_ratio: `System efficiency (%)`, cost_per_kw: `Cost per kW`,
    tips_title: `Energy-Saving Tips`,
    tip1_t: `Switch to LED`, tip1_d: `LED bulbs give the same light for a fraction of the power of incandescent or CFL lamps and last far longer.`,
    tip2_t: `Use the AC wisely`, tip2_d: `Set a moderate temperature, clean the filters regularly and pair it with a ceiling fan to feel cooler.`,
    tip3_t: `Cut standby power`, tip3_d: `Chargers, TVs and set-top boxes draw power even when idle. Use a switch strip and turn them off.`,
    tip4_t: `Look after the fridge`, tip4_d: `Keep it away from heat, do not overfill it, let hot food cool first and check the door seal.`,
    tip5_t: `Batch heavy tasks`, tip5_d: `Run the iron, washing machine and water pump in batches instead of in many short sessions.`,
    tip6_t: `Buy efficient`, tip6_d: `Choose inverter ACs and appliances with good efficiency ratings; they cost more upfront but save every month.`,
    faq_title: `Frequently Asked Questions`,
    faq1_q: `How is the bill calculated?`, faq1_a: `Each appliance's monthly energy is Wattage × Quantity × Hours/day × Days × Duty ÷ 1000 (in kWh). The total kWh is priced with your flat rate or slabs, then any fixed charge and VAT are added.`,
    faq2_q: `What is a slab (tiered) tariff?`, faq2_a: `Instead of one price for every unit, the first block of units has a lower rate, the next block a higher rate, and so on. The more you use, the higher the rate on the extra units.`,
    faq3_q: `Is the result exact?`, faq3_a: `No, it is an estimate. Real bills depend on actual usage, meter readings, current tariff, demand charges and any late fees. Check slab rates against your distributor's latest notice.`,
    faq4_q: `Is my data saved or uploaded?`, faq4_a: `Your appliances, settings, bill history and splitter are stored only in your own browser. Nothing is sent to a server. The share link packs only your appliances and tariff into the link itself.`,
    faq5_q: `Can I install it or use it offline?`, faq5_a: `Yes. SmartWatt is a Progressive Web App: use your browser's “Install” or “Add to Home Screen” option to use it like an app.`,
    about_title: `About SmartWatt`,
    step1_t: `Set your rate`, step1_d: `Pick a currency and a flat rate or slab tariff, plus VAT and fixed charges.`,
    step2_t: `Add appliances`, step2_d: `Choose from presets or enter your own wattage and daily usage.`,
    step3_t: `See your bill`, step3_d: `Get totals, charts and tips to cut your monthly electricity cost.`,
    team_title: `The team`, team_text: `SmartWatt is an ECE project built to help households understand and reduce their electricity use.`, created_by: `Created by`,
    feedback_title: `Send feedback`, fb_name: `Your name`, fb_msg: `Message`, fb_send: `Send`,
    footer_disclaimer: `Estimates only. Your actual bill may differ.`, back_top: `Back to top ↑`, est_short: `Est. bill`,
    /* dynamic */
    preset_choose: `— Choose —`,
    g_cooling: `Cooling`, g_lighting: `Lighting`, g_kitchen: `Kitchen`, g_ent: `Entertainment & office`, g_house: `Household`,
    room_bedroom: `Bedroom`, room_living: `Living room`, room_kitchen: `Kitchen`, room_bathroom: `Bathroom`, room_other: `Other`,
    count_one: `{n} item`, count_many: `{n} items`,
    btn_edit: `Edit`, btn_dup: `Copy`, btn_del: `Delete`, days_unit: `days`,
    slab_upto: `Up to (kWh)`, slab_above: `Above {n} kWh`, slab_rate: `Rate / kWh`,
    bd_energy: `Energy charge ({n} kWh)`, bd_fixed: `Fixed / demand charge`, bd_vat: `VAT ({p}%)`, bd_total: `Total`,
    budget_left: `{pct}% of budget used — {amt} left.`, budget_over: `Over budget by {amt}.`,
    ins_empty: `Add appliances to see personalised insights.`,
    ins_top: `{name} is your biggest consumer — about {pct}% of the bill ({amt}).`,
    ins_whatif: `Using {name} {cut} less per day could save around {amt} per month.`,
    ins_year: `At this rate your yearly electricity cost would be about {amt}.`,
    ins_co2: `Estimated emissions: about {kg} kg CO₂ per month.`,
    ins_slab: `Your last units are billed at {rate} per kWh — cutting use saves at the highest slab first.`,
    ins_budget_ok: `You are within your budget — {amt} left.`, ins_budget_over: `Over budget by {amt}. Try reducing the biggest consumers.`,
    ins_ac: `AC tip: a slightly higher temperature setting and clean filters cut consumption noticeably.`,
    ins_inc: `Replace incandescent bulbs with LED to use a fraction of the power.`,
    ins_fridge: `Fridge tip: keep it away from heat and check the door seal.`,
    u_h: `h`, u_min: `min`,
    err_req: `Required`, err_range: `Enter a value between {min} and {max}`, err_int: `Whole numbers only`,
    chart_others: `Others`, chart_offline: `Charts need an internet connection to load.`,
    m_units: `Units used`,
    s_gen: `Estimated generation / month`, s_save: `Estimated savings / month`, s_cost: `System cost`, s_payback: `Payback period`, s_years: `{n} years`, s_na: `—`, s_co2: `CO₂ avoided / year`,
    t_added: `Appliance added`, t_saved: `Changes saved`, t_deleted: `Appliance removed`, t_cleared: `All appliances cleared`, t_undo: `Undo`,
    t_copied: `Share link copied`, t_loaded: `Loaded shared bill`, t_csv: `CSV downloaded`, t_sent: `Thanks for your feedback!`,
    t_send_fail: `Could not send right now. The form works once the site is live on Netlify.`, t_empty_export: `Add an appliance first`,
    copy_prompt: `Copy this link:`,
    /* v3: bill check, history, splitter, report */
    nav_check: `Bill Check`, pdf_report: `PDF report`,
    calib_badge: `Calibrated ×{f}`,
    check_title: `Bill Check & History`,
    cmp_title: `Actual vs Estimated`,
    cmp_hint: `Enter your real bill to see how close the estimate is. You can then calibrate SmartWatt so future estimates match your home better.`,
    cmp_month: `Bill month`, cmp_actual: `Actual bill amount`, cmp_units: `Actual units (kWh, optional)`,
    cmp_need_app: `Add appliances first to get an estimate to compare.`,
    cmp_enter: `Enter your actual bill to compare.`,
    cmp_est: `Estimated bill (before calibration)`, cmp_est_cal: `Estimate with calibration`, cmp_act: `Actual bill`,
    cmp_diff: `Difference (actual − estimate)`, cmp_pct: `Difference %`,
    cmp_est_units: `Estimated units`, cmp_act_units: `Actual units`, cmp_impl_units: `Units implied by the bill (≈)`,
    cmp_factor: `Calibration factor`,
    cmp_v_close: `Very close — your appliance list is realistic.`,
    cmp_v_under: `The estimate is lower than the real bill. Some usage may be missing (more hours, extra appliances, standby power).`,
    cmp_v_over: `The estimate is higher than the real bill. Some hours or duty cycles may be set too high.`,
    cmp_v_far: `The gap is too large to calibrate reliably — please review your appliance list and tariff first.`,
    cmp_apply: `Apply calibration`, cmp_remove: `Remove calibration`, cmp_save: `Save to history`,
    err_month: `Pick a month (YYYY-MM)`, err_pos: `Enter a number greater than 0`,
    t_calib_on: `Calibration applied (×{f})`, t_calib_off: `Calibration removed`,
    t_hist_saved: `Saved to history`, t_hist_updated: `Month updated in history`, t_hist_deleted: `Entry removed`,
    t_hist_cleared: `History cleared`, t_hist_full: `History is full (60 months). Delete an entry first.`,
    t_hist_nothing: `Nothing to save yet — add appliances or an actual bill.`,
    hist_title: `Monthly history`, hist_count_one: `{n} month`, hist_count_many: `{n} months`,
    hist_empty_title: `No history yet`, hist_empty_text: `Save a month from the comparison card to start tracking.`,
    hist_chart_empty: `Save at least two months to see the trend.`,
    hist_est: `Estimated`, hist_act: `Actual`, hist_avg: `Average bill`, hist_high: `Highest month`, hist_change: `Latest change`,
    hist_export: `Export history`, hist_clear: `Clear history`, hist_kwh_est: `{n} kWh estimated`,
    split_title: `Bill Splitter`,
    split_hint: `Divide one electricity bill between people, flats or tenants — equally, by shares, or by sub-meter readings.`,
    split_amount: `Bill amount to split`, split_amount_ph: `Empty = estimated bill`, split_mode: `Split method`,
    split_equal: `Equally`, split_share: `By shares (rooms / members)`, split_meter: `By sub-meter readings`,
    split_name: `Name`, split_share_lbl: `Share`, split_prev: `Previous reading`, split_curr: `Current reading`,
    split_person: `Person {n}`, split_add: `+ Add person`, split_copy: `Copy summary`, split_remove: `Remove person`,
    split_using_est: `Splitting the estimated bill.`, split_using_amt: `Splitting the amount you entered.`,
    split_fallback: `All shares/readings are zero, so the bill is split equally.`,
    split_zero: `Enter a bill amount or add appliances to see the split.`,
    split_summary_head: `SmartWatt bill split`, t_split_copied: `Split summary copied`,
    rep_title: `Electricity Bill Report`, rep_generated: `Generated on {d}`, rep_tariff_h: `Tariff & charges`,
    rep_col_name: `Appliance`, rep_col_room: `Room`, rep_col_load: `Load`, rep_col_usage: `Usage`, rep_col_kwh: `kWh`, rep_col_cost: `Cost`,
    rep_appliances_h: `Appliances`, rep_history_h: `Recent history`,
    t_pdf_hint: `In the print window, choose “Save as PDF”.`,
  },
  bn: {
    skip: `ক্যালকুলেটরে যান`, nav_calc: `ক্যালকুলেটর`, nav_analysis: `বিশ্লেষণ`, nav_tools: `টুলস`, nav_tips: `টিপস`, nav_faq: `প্রশ্নোত্তর`, nav_about: `সম্পর্কে`,
    hero_badge: `ইসিই প্রজেক্ট · বিদ্যুৎ বিল ক্যালকুলেটর`,
    hero_title: `বিল আসার আগেই জানুন আপনার <span>বিদ্যুৎ খরচ</span>`,
    hero_sub: `আপনার যন্ত্রপাতি যোগ করুন, ট্যারিফ বেছে নিন এবং চার্ট, সাশ্রয়ের টিপস ও সোলার তথ্যসহ তাৎক্ষণিক মাসিক হিসাব পান।`,
    hero_cta: `হিসাব শুরু করুন`, hero_install: `অ্যাপ ইনস্টল করুন`,
    settings: `ইউনিট রেট সেটিংস`, currency: `মুদ্রা`, mode_flat: `ফ্ল্যাট রেট`, mode_slab: `স্ল্যাব (ধাপভিত্তিক)`,
    unit_price: `ইউনিট মূল্য (প্রতি kWh)`,
    slab_hint: `ধাপভিত্তিক ট্যারিফে প্রতিটি ইউনিট ব্লকের আলাদা রেট প্রযোজ্য। ডিফল্ট মানগুলো নমুনা আবাসিক রেট — অনুগ্রহ করে আপনার বিতরণ সংস্থার সর্বশেষ ট্যারিফ মিলিয়ে নিন।`,
    slab_reset: `ডিফল্ট স্ল্যাবে ফিরে যান`, vat: `ভ্যাট (%)`, fixed: `নির্ধারিত / ডিমান্ড চার্জ`, billing_days: `বিলের দিন`, budget: `মাসিক বাজেট (ঐচ্ছিক)`,
    add_appliance: `যন্ত্র যোগ করুন`, edit_appliance: `যন্ত্র সম্পাদনা`, choose_preset: `যন্ত্র নির্বাচন করুন`, app_name: `যন্ত্রের নাম`, or_custom: `(অথবা নিজে লিখুন)`, ph_name: `যেমন: সিলিং ফ্যান`,
    wattage: `ওয়াট (W)`, quantity: `সংখ্যা`, hours: `দৈনিক ব্যবহার (ঘণ্টা/দিন)`, days: `মাসে ব্যবহারের দিন`, duty: `ডিউটি সাইকেল (%)`, room: `কক্ষ`,
    duty_hint: `ডিউটি সাইকেল: যন্ত্রটি আসলে কত সময় পূর্ণ শক্তিতে চলে (যেমন ফ্রিজ ≈ ৪০%, এসি ≈ ৬০%)।`,
    add_to_bill: `+ বিলে যোগ করুন`, save_changes: `পরিবর্তন সংরক্ষণ`, cancel: `বাতিল`,
    formula: `<b>মাসিক kWh</b> = (ওয়াট × সংখ্যা × ঘণ্টা/দিন × দিন × ডিউটি%) ÷ ১০০০<br><b>মাসিক খরচ</b> = মাসিক kWh × ইউনিট মূল্য`,
    est_bill: `আনুমানিক মাসিক বিল`, total_units: `মোট ইউনিট`, per_day: `প্রতিদিন`, daily_cost: `দৈনিক খরচ`, yearly: `বার্ষিক আনুমানিক`, co2: `CO₂ / মাস`, avg_rate: `গড় রেট / kWh`,
    breakdown: `বিলের বিস্তারিত`, export_csv: `CSV এক্সপোর্ট`, print: `প্রিন্ট`, share: `শেয়ার লিংক`,
    your_appliances: `আপনার যন্ত্রপাতি`, sort_by: `সাজান`, sort_cost: `সবচেয়ে বেশি খরচ`, sort_added: `সর্বশেষ যোগ`, sort_name: `নাম অনুযায়ী`, clear_all: `সব মুছুন`,
    empty_title: `এখনো কোনো যন্ত্র নেই`, empty_text: `একটি যন্ত্র বেছে নিন বা নিজে লিখুন, তারপর “বিলে যোগ করুন” চাপুন।`,
    analysis: `ব্যবহার বিশ্লেষণ`, chart_app: `যন্ত্র অনুযায়ী খরচ`, chart_empty: `চার্ট দেখতে যন্ত্র যোগ করুন।`, chart_room: `কক্ষ অনুযায়ী শক্তি (kWh)`, insights: `স্মার্ট পরামর্শ`,
    tools_title: `আরও টুলস`, meter_title: `মিটার রিডিং ক্যালকুলেটর`,
    meter_hint: `আগের ও বর্তমান মিটার রিডিং দিন। উপরে নির্ধারিত ট্যারিফ, ভ্যাট ও চার্জ ব্যবহার হবে।`,
    prev_reading: `আগের রিডিং`, curr_reading: `বর্তমান রিডিং`,
    solar_title: `সোলার সাশ্রয়ের আনুমানিক হিসাব`,
    solar_hint: `ছাদে সোলার সিস্টেম বসালে বিল কতটা কমতে পারে তার মোটামুটি হিসাব। খরচগুলো পরিবর্তনযোগ্য ধারণা।`,
    sys_size: `সিস্টেমের আকার (kW)`, sun_hours: `দৈনিক পিক সূর্যালোক (ঘণ্টা)`, perf_ratio: `সিস্টেম দক্ষতা (%)`, cost_per_kw: `প্রতি kW খরচ`,
    tips_title: `বিদ্যুৎ সাশ্রয়ের টিপস`,
    tip1_t: `এলইডিতে বদলান`, tip1_d: `এলইডি বাল্ব ইনক্যান্ডেসেন্ট বা সিএফএলের তুলনায় অনেক কম বিদ্যুতে একই আলো দেয় এবং অনেক বেশি টেকে।`,
    tip2_t: `বুদ্ধি করে এসি চালান`, tip2_d: `মাঝারি তাপমাত্রা সেট করুন, নিয়মিত ফিল্টার পরিষ্কার করুন এবং সিলিং ফ্যানের সাথে ব্যবহার করুন।`,
    tip3_t: `স্ট্যান্ডবাই বিদ্যুৎ কমান`, tip3_d: `চার্জার, টিভি ও সেট-টপ বক্স বন্ধ থাকলেও কিছু বিদ্যুৎ টানে। সুইচসহ এক্সটেনশন ব্যবহার করে বন্ধ রাখুন।`,
    tip4_t: `ফ্রিজের যত্ন নিন`, tip4_d: `তাপ থেকে দূরে রাখুন, বেশি ঠেসে ভরবেন না, গরম খাবার ঠান্ডা করে রাখুন এবং দরজার সিল ঠিক আছে কিনা দেখুন।`,
    tip5_t: `ভারী কাজ একসাথে করুন`, tip5_d: `ইস্ত্রি, ওয়াশিং মেশিন ও পানির পাম্প অল্প অল্প করে বারবার না চালিয়ে একসাথে চালান।`,
    tip6_t: `কার্যকর যন্ত্র কিনুন`, tip6_d: `ইনভার্টার এসি ও ভালো দক্ষতার রেটিংযুক্ত যন্ত্র কিনুন; দাম বেশি হলেও প্রতি মাসে সাশ্রয় হয়।`,
    faq_title: `সাধারণ প্রশ্নোত্তর`,
    faq1_q: `বিল কীভাবে হিসাব করা হয়?`, faq1_a: `প্রতিটি যন্ত্রের মাসিক শক্তি = ওয়াট × সংখ্যা × ঘণ্টা/দিন × দিন × ডিউটি ÷ ১০০০ (kWh)। মোট kWh আপনার ফ্ল্যাট রেট বা স্ল্যাব অনুযায়ী মূল্য ধরা হয়, তারপর নির্ধারিত চার্জ ও ভ্যাট যোগ হয়।`,
    faq2_q: `স্ল্যাব (ধাপভিত্তিক) ট্যারিফ কী?`, faq2_a: `সব ইউনিটের একই দাম না হয়ে প্রথম ব্লকের ইউনিটের রেট কম, পরের ব্লকের বেশি—এভাবে বাড়তে থাকে। যত বেশি ব্যবহার, অতিরিক্ত ইউনিটের রেট তত বেশি।`,
    faq3_q: `ফলাফল কি নির্ভুল?`, faq3_a: `না, এটি একটি আনুমানিক হিসাব। প্রকৃত বিল নির্ভর করে বাস্তব ব্যবহার, মিটার রিডিং, বর্তমান ট্যারিফ, ডিমান্ড চার্জ ও বিলম্ব ফির ওপর। স্ল্যাব রেট আপনার বিতরণ সংস্থার সর্বশেষ বিজ্ঞপ্তির সাথে মিলিয়ে নিন।`,
    faq4_q: `আমার তথ্য কি সংরক্ষিত বা আপলোড হয়?`, faq4_a: `আপনার যন্ত্র, সেটিংস, বিলের ইতিহাস ও ভাগের তথ্য শুধু আপনার নিজের ব্রাউজারে সংরক্ষিত থাকে। কোনো সার্ভারে পাঠানো হয় না। শেয়ার লিংকে শুধু যন্ত্র ও ট্যারিফের তথ্য লিংকের ভেতরেই থাকে।`,
    faq5_q: `এটি কি ইনস্টল করা বা অফলাইনে চালানো যায়?`, faq5_a: `হ্যাঁ। SmartWatt একটি প্রগ্রেসিভ ওয়েব অ্যাপ: ব্রাউজারের “Install” বা “Add to Home Screen” ব্যবহার করে অ্যাপের মতো চালাতে পারবেন।`,
    about_title: `SmartWatt সম্পর্কে`,
    step1_t: `রেট ঠিক করুন`, step1_d: `মুদ্রা, ফ্ল্যাট রেট বা স্ল্যাব ট্যারিফ এবং ভ্যাট ও নির্ধারিত চার্জ বেছে নিন।`,
    step2_t: `যন্ত্র যোগ করুন`, step2_d: `প্রিসেট থেকে বাছুন বা নিজের ওয়াট ও দৈনিক ব্যবহার লিখুন।`,
    step3_t: `বিল দেখুন`, step3_d: `মোট হিসাব, চার্ট ও মাসিক বিদ্যুৎ খরচ কমানোর টিপস পান।`,
    team_title: `আমাদের দল`, team_text: `SmartWatt একটি ইসিই প্রজেক্ট, যা পরিবারগুলোকে বিদ্যুৎ ব্যবহার বুঝতে ও কমাতে সাহায্য করে।`, created_by: `তৈরি করেছেন`,
    feedback_title: `মতামত পাঠান`, fb_name: `আপনার নাম`, fb_msg: `বার্তা`, fb_send: `পাঠান`,
    footer_disclaimer: `এটি শুধু আনুমানিক হিসাব। প্রকৃত বিল ভিন্ন হতে পারে।`, back_top: `উপরে ফিরুন ↑`, est_short: `আনু. বিল`,
    /* dynamic */
    preset_choose: `— বেছে নিন —`,
    g_cooling: `শীতলীকরণ`, g_lighting: `আলো`, g_kitchen: `রান্নাঘর`, g_ent: `বিনোদন ও অফিস`, g_house: `ঘরোয়া`,
    room_bedroom: `শোবার ঘর`, room_living: `বসার ঘর`, room_kitchen: `রান্নাঘর`, room_bathroom: `বাথরুম`, room_other: `অন্যান্য`,
    count_one: `{n}টি যন্ত্র`, count_many: `{n}টি যন্ত্র`,
    btn_edit: `সম্পাদনা`, btn_dup: `কপি`, btn_del: `মুছুন`, days_unit: `দিন`,
    slab_upto: `পর্যন্ত (kWh)`, slab_above: `{n} kWh-এর বেশি`, slab_rate: `রেট / kWh`,
    bd_energy: `বিদ্যুৎ চার্জ ({n} kWh)`, bd_fixed: `নির্ধারিত / ডিমান্ড চার্জ`, bd_vat: `ভ্যাট ({p}%)`, bd_total: `মোট`,
    budget_left: `বাজেটের {pct}% ব্যবহৃত — বাকি {amt}।`, budget_over: `বাজেট ছাড়িয়েছে {amt}।`,
    ins_empty: `ব্যক্তিগত পরামর্শ দেখতে যন্ত্র যোগ করুন।`,
    ins_top: `{name} আপনার সবচেয়ে বেশি বিদ্যুৎ খরচকারী — বিলের প্রায় {pct}% ({amt})।`,
    ins_whatif: `প্রতিদিন {name} {cut} কম চালালে মাসে প্রায় {amt} সাশ্রয় হতে পারে।`,
    ins_year: `এই হারে আপনার বার্ষিক বিদ্যুৎ খরচ প্রায় {amt}।`,
    ins_co2: `আনুমানিক নিঃসরণ: মাসে প্রায় {kg} kg CO₂।`,
    ins_slab: `আপনার শেষ ইউনিটগুলো প্রতি kWh {rate} হারে ধরা হচ্ছে — ব্যবহার কমালে সবচেয়ে উঁচু স্ল্যাব থেকে সাশ্রয় শুরু হয়।`,
    ins_budget_ok: `আপনি বাজেটের মধ্যে আছেন — বাকি {amt}।`, ins_budget_over: `বাজেট ছাড়িয়েছে {amt}। বেশি খরচের যন্ত্রগুলোর ব্যবহার কমানোর চেষ্টা করুন।`,
    ins_ac: `এসি টিপস: তাপমাত্রা একটু বাড়িয়ে রাখলে ও ফিল্টার পরিষ্কার রাখলে খরচ উল্লেখযোগ্যভাবে কমে।`,
    ins_inc: `ইনক্যান্ডেসেন্ট বাল্বের বদলে এলইডি লাগালে অনেক কম বিদ্যুৎ লাগে।`,
    ins_fridge: `ফ্রিজ টিপস: তাপ থেকে দূরে রাখুন এবং দরজার সিল পরীক্ষা করুন।`,
    u_h: `ঘণ্টা`, u_min: `মিনিট`,
    err_req: `আবশ্যক`, err_range: `{min} থেকে {max}-এর মধ্যে মান দিন`, err_int: `শুধু পূর্ণসংখ্যা`,
    chart_others: `অন্যান্য`, chart_offline: `চার্ট লোড করতে ইন্টারনেট সংযোগ লাগবে।`,
    m_units: `ব্যবহৃত ইউনিট`,
    s_gen: `মাসিক উৎপাদন (আনু.)`, s_save: `মাসিক সাশ্রয় (আনু.)`, s_cost: `সিস্টেমের খরচ`, s_payback: `খরচ উঠে আসার সময়`, s_years: `{n} বছর`, s_na: `—`, s_co2: `বছরে CO₂ কম`,
    t_added: `যন্ত্র যোগ হয়েছে`, t_saved: `পরিবর্তন সংরক্ষিত`, t_deleted: `যন্ত্র মুছে ফেলা হয়েছে`, t_cleared: `সব যন্ত্র মুছে ফেলা হয়েছে`, t_undo: `ফিরিয়ে আনুন`,
    t_copied: `শেয়ার লিংক কপি হয়েছে`, t_loaded: `শেয়ার করা বিল লোড হয়েছে`, t_csv: `CSV ডাউনলোড হয়েছে`, t_sent: `মতামতের জন্য ধন্যবাদ!`,
    t_send_fail: `এখন পাঠানো যায়নি। সাইট Netlify-তে লাইভ হলে ফর্মটি কাজ করবে।`, t_empty_export: `আগে একটি যন্ত্র যোগ করুন`,
    copy_prompt: `এই লিংকটি কপি করুন:`,
    /* v3: bill check, history, splitter, report */
    nav_check: `বিল যাচাই`, pdf_report: `পিডিএফ রিপোর্ট`,
    calib_badge: `ক্যালিব্রেটেড ×{f}`,
    check_title: `বিল যাচাই ও ইতিহাস`,
    cmp_title: `প্রকৃত বনাম আনুমানিক`,
    cmp_hint: `আপনার প্রকৃত বিল দিন এবং দেখুন হিসাব কতটা কাছাকাছি। তারপর ক্যালিব্রেট করলে ভবিষ্যতের হিসাব আপনার বাসার সাথে আরও মিলবে।`,
    cmp_month: `বিলের মাস`, cmp_actual: `প্রকৃত বিলের পরিমাণ`, cmp_units: `প্রকৃত ইউনিট (kWh, ঐচ্ছিক)`,
    cmp_need_app: `তুলনার জন্য আগে যন্ত্র যোগ করুন।`,
    cmp_enter: `তুলনা করতে প্রকৃত বিল লিখুন।`,
    cmp_est: `আনুমানিক বিল (ক্যালিব্রেশনের আগে)`, cmp_est_cal: `ক্যালিব্রেশনসহ আনুমানিক বিল`, cmp_act: `প্রকৃত বিল`,
    cmp_diff: `পার্থক্য (প্রকৃত − আনুমানিক)`, cmp_pct: `পার্থক্য %`,
    cmp_est_units: `আনুমানিক ইউনিট`, cmp_act_units: `প্রকৃত ইউনিট`, cmp_impl_units: `বিল অনুযায়ী আনুমানিক ইউনিট (≈)`,
    cmp_factor: `ক্যালিব্রেশন ফ্যাক্টর`,
    cmp_v_close: `খুবই কাছাকাছি — আপনার যন্ত্রের তালিকা বাস্তবসম্মত।`,
    cmp_v_under: `আনুমানিক বিল প্রকৃত বিলের চেয়ে কম। কিছু ব্যবহার বাদ পড়তে পারে (বেশি ঘণ্টা, বাড়তি যন্ত্র, স্ট্যান্ডবাই বিদ্যুৎ)।`,
    cmp_v_over: `আনুমানিক বিল প্রকৃত বিলের চেয়ে বেশি। কিছু ঘণ্টা বা ডিউটি সাইকেল বেশি ধরা হয়ে থাকতে পারে।`,
    cmp_v_far: `পার্থক্য এত বেশি যে নির্ভরযোগ্য ক্যালিব্রেশন সম্ভব নয় — আগে যন্ত্রের তালিকা ও ট্যারিফ দেখুন।`,
    cmp_apply: `ক্যালিব্রেশন প্রয়োগ`, cmp_remove: `ক্যালিব্রেশন সরান`, cmp_save: `ইতিহাসে সংরক্ষণ`,
    err_month: `মাস বেছে নিন (YYYY-MM)`, err_pos: `০-এর চেয়ে বড় সংখ্যা দিন`,
    t_calib_on: `ক্যালিব্রেশন প্রয়োগ হয়েছে (×{f})`, t_calib_off: `ক্যালিব্রেশন সরানো হয়েছে`,
    t_hist_saved: `ইতিহাসে সংরক্ষিত`, t_hist_updated: `ইতিহাসে মাসটি আপডেট হয়েছে`, t_hist_deleted: `এন্ট্রি মুছে ফেলা হয়েছে`,
    t_hist_cleared: `ইতিহাস মুছে ফেলা হয়েছে`, t_hist_full: `ইতিহাস পূর্ণ (৬০ মাস)। আগে একটি এন্ট্রি মুছুন।`,
    t_hist_nothing: `সংরক্ষণের মতো কিছু নেই — যন্ত্র বা প্রকৃত বিল যোগ করুন।`,
    hist_title: `মাসিক ইতিহাস`, hist_count_one: `{n} মাস`, hist_count_many: `{n} মাস`,
    hist_empty_title: `এখনো কোনো ইতিহাস নেই`, hist_empty_text: `ট্র্যাকিং শুরু করতে তুলনার কার্ড থেকে একটি মাস সংরক্ষণ করুন।`,
    hist_chart_empty: `ট্রেন্ড দেখতে অন্তত দুটি মাস সংরক্ষণ করুন।`,
    hist_est: `আনুমানিক`, hist_act: `প্রকৃত`, hist_avg: `গড় বিল`, hist_high: `সর্বোচ্চ মাস`, hist_change: `সর্বশেষ পরিবর্তন`,
    hist_export: `ইতিহাস এক্সপোর্ট`, hist_clear: `ইতিহাস মুছুন`, hist_kwh_est: `আনুমানিক {n} kWh`,
    split_title: `বিল ভাগ করুন`,
    split_hint: `একটি বিদ্যুৎ বিল মানুষ, ফ্ল্যাট বা ভাড়াটিয়াদের মধ্যে ভাগ করুন — সমান, অংশ অনুযায়ী বা সাব-মিটার রিডিং অনুযায়ী।`,
    split_amount: `ভাগ করার বিলের পরিমাণ`, split_amount_ph: `খালি = আনুমানিক বিল`, split_mode: `ভাগের পদ্ধতি`,
    split_equal: `সমান ভাগে`, split_share: `অংশ অনুযায়ী (কক্ষ / সদস্য)`, split_meter: `সাব-মিটার রিডিং অনুযায়ী`,
    split_name: `নাম`, split_share_lbl: `অংশ`, split_prev: `আগের রিডিং`, split_curr: `বর্তমান রিডিং`,
    split_person: `ব্যক্তি {n}`, split_add: `+ ব্যক্তি যোগ করুন`, split_copy: `সারাংশ কপি`, split_remove: `ব্যক্তি সরান`,
    split_using_est: `আনুমানিক বিল ভাগ হচ্ছে।`, split_using_amt: `আপনার দেওয়া পরিমাণ ভাগ হচ্ছে।`,
    split_fallback: `সব অংশ/রিডিং শূন্য, তাই বিল সমান ভাগ করা হয়েছে।`,
    split_zero: `ভাগ দেখতে বিলের পরিমাণ দিন বা যন্ত্র যোগ করুন।`,
    split_summary_head: `SmartWatt বিল ভাগ`, t_split_copied: `ভাগের সারাংশ কপি হয়েছে`,
    rep_title: `বিদ্যুৎ বিলের রিপোর্ট`, rep_generated: `তৈরি হয়েছে {d}`, rep_tariff_h: `ট্যারিফ ও চার্জ`,
    rep_col_name: `যন্ত্র`, rep_col_room: `কক্ষ`, rep_col_load: `লোড`, rep_col_usage: `ব্যবহার`, rep_col_kwh: `kWh`, rep_col_cost: `খরচ`,
    rep_appliances_h: `যন্ত্রপাতি`, rep_history_h: `সাম্প্রতিক ইতিহাস`,
    t_pdf_hint: `প্রিন্ট উইন্ডোতে “Save as PDF” বেছে নিন।`,
  },
};

/* ================= state ================= */
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const HIST_MAX = 60;
const CALIB_MIN = 0.2;
const CALIB_MAX = 5;
const SPLIT_MODES = ['equal', 'share', 'meter'];
const SPLIT_MIN = 2;
const SPLIT_MAX = 12;

const newPerson = () => ({ id: uid(), name: '', share: 1, prev: 0, curr: 0 });

const defaults = () => ({
  currency: 'BDT', mode: 'flat', rate: 8.5, vat: 5, fixed: 0, billingDays: 30, budget: 0,
  slabs: DEFAULT_SLABS(), appliances: [], lang: 'en', theme: 'dark',
  calib: 1, calibOn: false,
  history: [],
  cmp: { month: '', actual: '', units: '' },
  split: { mode: 'equal', amount: '', people: [newPerson(), newPerson()] },
});

const cleanNumStr = v => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? String(n) : ''; };

function sanitize(src, base) {
  const s = Object.assign({}, base);
  if (!src || typeof src !== 'object') return s;
  if (CURRENCIES[src.currency]) s.currency = src.currency;
  if (src.mode === 'slab' || src.mode === 'flat') s.mode = src.mode;
  ['rate', 'vat', 'fixed', 'budget'].forEach(k => {
    const n = parseFloat(src[k]);
    if (Number.isFinite(n) && n >= 0) s[k] = n;
  });
  if (Number.isFinite(parseFloat(src.billingDays))) s.billingDays = clamp(Math.round(parseFloat(src.billingDays)), 1, 31);
  if (Array.isArray(src.slabs) && src.slabs.length >= 2 && src.slabs.length <= 12) {
    s.slabs = src.slabs.map((x, i, a) => ({
      upto: i === a.length - 1 ? null : Math.max(0, toNum(x && x.upto)),
      rate: Math.max(0, toNum(x && x.rate)),
    }));
  }
  if (Array.isArray(src.appliances)) {
    s.appliances = src.appliances.slice(0, 200).map(a => ({
      id: String((a && a.id) || uid()),
      name: String((a && a.name) || 'Appliance').slice(0, 40),
      icon: String((a && a.icon) || '🔌').slice(0, 4),
      pid: a && a.pid ? String(a.pid).slice(0, 20) : '',
      w: clamp(toNum(a && a.w), 0, 20000),
      q: clamp(Math.round(toNum(a && a.q)) || 1, 1, 100),
      h: clamp(toNum(a && a.h), 0, 24),
      d: clamp(Math.round(toNum(a && a.d)) || 30, 1, 31),
      duty: clamp(toNum(a && a.duty) || 100, 1, 100),
      room: ROOMS.includes(a && a.room) ? a.room : 'other',
    }));
  }
  // calibration
  const cf = parseFloat(src.calib);
  const cfOk = Number.isFinite(cf) && cf >= CALIB_MIN && cf <= CALIB_MAX;
  if (cfOk) s.calib = cf;
  s.calibOn = src.calibOn === true && cfOk;

  // monthly history (one entry per month)
  if (Array.isArray(src.history)) {
    const seen = new Set();
    s.history = src.history.slice(0, 200).map(e => ({
      id: String((e && e.id) || uid()),
      month: e && MONTH_RE.test(e.month) ? e.month : '',
      cur: e && CURRENCIES[e.cur] ? e.cur : 'BDT',
      est: Math.max(0, toNum(e && e.est)),
      actual: Math.max(0, toNum(e && e.actual)),
      kwh: Math.max(0, toNum(e && e.kwh)),
      akwh: Math.max(0, toNum(e && e.akwh)),
    })).filter(e => {
      if (!e.month || !(e.est > 0 || e.actual > 0) || seen.has(e.month)) return false;
      seen.add(e.month);
      return true;
    }).sort((a, b) => a.month.localeCompare(b.month)).slice(-HIST_MAX);
  }

  // last comparison inputs
  if (src.cmp && typeof src.cmp === 'object') {
    s.cmp = {
      month: MONTH_RE.test(src.cmp.month) ? src.cmp.month : '',
      actual: cleanNumStr(src.cmp.actual),
      units: cleanNumStr(src.cmp.units),
    };
  }

  // bill splitter
  if (src.split && typeof src.split === 'object') {
    const sp = src.split;
    const people = Array.isArray(sp.people) && sp.people.length >= SPLIT_MIN && sp.people.length <= SPLIT_MAX
      ? sp.people.map(p => {
        const share = parseFloat(p && p.share);
        return {
          id: String((p && p.id) || uid()),
          name: String((p && p.name) || '').slice(0, 24),
          share: Number.isFinite(share) ? clamp(share, 0, 1000) : 1,
          prev: Math.max(0, toNum(p && p.prev)),
          curr: Math.max(0, toNum(p && p.curr)),
        };
      })
      : s.split.people;
    s.split = {
      mode: SPLIT_MODES.includes(sp.mode) ? sp.mode : 'equal',
      amount: cleanNumStr(sp.amount),
      people,
    };
  }

  if (src.lang === 'bn' || src.lang === 'en') s.lang = src.lang;
  if (src.theme === 'light' || src.theme === 'dark') s.theme = src.theme;
  return s;
}

function loadState() {
  const base = defaults();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return sanitize(JSON.parse(raw), base);
  } catch (e) { /* storage blocked or corrupt – fall back to defaults */ }
  return base;
}

let state = loadState();

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

/* ================= i18n + formatting ================= */
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const localize = s => state.lang === 'bn' ? String(s).replace(/\d/g, d => BN_DIGITS[d]) : String(s);
const nf = n => localize(String(+(+n).toFixed(2)));
const num = (n, dec = 2) => localize(Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
const sym = () => CURRENCIES[state.currency].sym;
const money = n => sym() + ' ' + num(n);

function t(key, params) {
  const dict = I18N[state.lang] || I18N.en;
  let s = dict[key] != null ? dict[key] : (I18N.en[key] != null ? I18N.en[key] : key);
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? params[k] : m));
  return s;
}

function applyI18n() {
  document.documentElement.lang = state.lang;
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $('#langBtn').textContent = state.lang === 'en' ? 'বাংলা' : 'English';
}

/* ================= toast ================= */
let toastTimer;
function hideToast() { $('#toast').classList.remove('show'); }
function toast(msg, action) {
  const el = $('#toast');
  el.innerHTML = '';
  const sp = document.createElement('span');
  sp.textContent = msg;
  el.appendChild(sp);
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = action.label;
    b.addEventListener('click', () => { action.fn(); hideToast(); });
    el.appendChild(b);
  }
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 6000 : 2800);
}

/* ================= calculations ================= */
const baseKwh = a => (a.w * a.q * a.h * a.d * (a.duty / 100)) / 1000;
const calibFactor = () => (state.calibOn ? state.calib : 1);
const itemKwh = a => baseKwh(a) * calibFactor();

function energyCharge(kwh) {
  if (state.mode === 'slab') {
    let prev = 0, total = 0;
    const parts = [];
    state.slabs.forEach(s => {
      const limit = s.upto == null ? Infinity : s.upto;
      const units = Math.max(0, Math.min(kwh, limit) - prev);
      if (units > 0) parts.push({ from: prev, to: limit, units, rate: s.rate, cost: units * s.rate });
      total += units * s.rate;
      prev = Math.max(prev, limit);
    });
    return { cost: total, parts };
  }
  return { cost: kwh * state.rate, parts: [] };
}

function billFor(kwh) {
  if (!(kwh > 0)) return { energy: 0, parts: [], fixed: 0, vat: 0, total: 0 };
  const e = energyCharge(kwh);
  const fixed = state.fixed || 0;
  const sub = e.cost + fixed;
  const vat = sub * (state.vat || 0) / 100;
  return { energy: e.cost, parts: e.parts, fixed, vat, total: sub + vat };
}

function compute() {
  const items = state.appliances.map(a => Object.assign({}, a, { kwh: itemKwh(a) }));
  const total = items.reduce((s, a) => s + a.kwh, 0);
  const raw = state.appliances.reduce((s, a) => s + baseKwh(a), 0); // before calibration
  const bill = billFor(total);
  items.forEach(a => { a.cost = total > 0 ? bill.total * a.kwh / total : 0; });
  return { items, total, raw, bill };
}

/* ================= DOM refs ================= */
const F = {
  name: $('#aName'), w: $('#aW'), q: $('#aQ'), h: $('#aH'), d: $('#aD'), duty: $('#aDuty'), room: $('#aRoom'),
};
let editingId = null;
let formMeta = { icon: '🔌', pid: '' };
let sortKey = 'cost';
let solarDirty = false;

/* ================= settings UI ================= */
function fmtRate(r) { return r < 1 ? r.toFixed(2) : String(r); }

function renderChips() {
  const box = $('#presetChips');
  box.innerHTML = '';
  Object.entries(CURRENCIES).forEach(([code, c]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (state.currency === code && state.rate === c.rate ? ' on' : '');
    b.textContent = localize(`${c.flag} ${c.sym}${fmtRate(c.rate)}`);
    b.addEventListener('click', () => {
      state.currency = code;
      state.rate = c.rate;
      renderSettings();
      suggestSolarCost();
      update();
    });
    box.appendChild(b);
  });
}

function renderSettings() {
  $('#currency').value = state.currency;
  $('#rate').value = state.rate;
  $('#vat').value = state.vat;
  $('#fixed').value = state.fixed;
  $('#billingDays').value = state.billingDays;
  $('#budget').value = state.budget || '';
  $$('.seg-b').forEach(b => {
    const on = b.dataset.mode === state.mode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  $('#flatBox').hidden = state.mode !== 'flat';
  $('#slabBox').hidden = state.mode !== 'slab';
  renderChips();
}

function renderSlabs() {
  const box = $('#slabRows');
  box.innerHTML = '';
  state.slabs.forEach((s, i) => {
    const last = i === state.slabs.length - 1;
    const row = document.createElement('div');
    row.className = 'slab-row';
    const left = last
      ? `<div class="above" data-above></div>`
      : `<label>${esc(t('slab_upto'))}<input type="number" min="0" step="any" inputmode="decimal" value="${s.upto}" data-i="${i}" data-k="upto"></label>`;
    row.innerHTML = left +
      `<label>${esc(t('slab_rate'))}<input type="number" min="0" step="0.01" inputmode="decimal" value="${s.rate}" data-i="${i}" data-k="rate"></label>`;
    box.appendChild(row);
  });
  updateAboveLabel();
}

function updateAboveLabel() {
  const el = $('[data-above]');
  if (!el) return;
  const prev = state.slabs[state.slabs.length - 2];
  el.textContent = t('slab_above', { n: nf(prev ? prev.upto : 0) });
}

function suggestSolarCost() {
  if (!solarDirty) $('#sCost').value = CURRENCIES[state.currency].solar;
}

/* ================= selects ================= */
function buildPresetSelect() {
  const sel = $('#preset');
  const prev = sel.value;
  sel.innerHTML = '';
  const o0 = document.createElement('option');
  o0.value = '';
  o0.textContent = t('preset_choose');
  sel.appendChild(o0);
  PRESET_GROUPS.forEach(g => {
    const og = document.createElement('optgroup');
    og.label = t('g_' + g);
    PRESETS.filter(p => p.g === g).forEach(p => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = `${p.icon} ${p.n[state.lang]}`;
      og.appendChild(o);
    });
    sel.appendChild(og);
  });
  sel.value = prev;
}

function buildRoomSelect() {
  const sel = F.room;
  const prev = sel.value || 'bedroom';
  sel.innerHTML = '';
  ROOMS.forEach(r => {
    const o = document.createElement('option');
    o.value = r;
    o.textContent = t('room_' + r);
    sel.appendChild(o);
  });
  sel.value = prev;
}

/* ================= form ================= */
function setErr(input, msg) {
  const el = input.closest('label').querySelector('.err');
  if (el) el.textContent = msg || '';
  input.classList.toggle('invalid', !!msg);
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
}

function validate() {
  let ok = true;
  let firstBad = null;
  const name = F.name.value.trim();
  if (!name) { setErr(F.name, t('err_req')); ok = false; firstBad = firstBad || F.name; } else setErr(F.name, '');
  const rules = [['w', 0.1, 20000, false], ['q', 1, 100, true], ['h', 0.05, 24, false], ['d', 1, 31, true], ['duty', 1, 100, false]];
  rules.forEach(([k, min, max, int]) => {
    const raw = F[k].value.trim();
    const v = parseFloat(raw);
    let m = '';
    if (raw === '' || !Number.isFinite(v)) m = t('err_req');
    else if (v < min || v > max) m = t('err_range', { min: nf(min), max: nf(max) });
    else if (int && !Number.isInteger(v)) m = t('err_int');
    setErr(F[k], m);
    if (m) { ok = false; firstBad = firstBad || F[k]; }
  });
  if (firstBad) firstBad.focus();
  return ok;
}

function clearErrors() {
  Object.values(F).forEach(el => { if (el.tagName === 'INPUT') setErr(el, ''); });
}

function refreshFormMode() {
  const editing = !!editingId;
  $('#formTitle').textContent = t(editing ? 'edit_appliance' : 'add_appliance');
  $('#submitBtn').textContent = t(editing ? 'save_changes' : 'add_to_bill');
  $('#cancelEdit').hidden = !editing;
}

function resetForm() {
  editingId = null;
  formMeta = { icon: '🔌', pid: '' };
  $('#preset').value = '';
  F.name.value = '';
  F.w.value = '';
  F.q.value = 1;
  F.h.value = '';
  F.d.value = 30;
  F.duty.value = 100;
  F.room.value = 'bedroom';
  clearErrors();
  refreshFormMode();
}

function startEdit(id) {
  const a = state.appliances.find(x => x.id === id);
  if (!a) return;
  editingId = id;
  formMeta = { icon: a.icon, pid: a.pid };
  $('#preset').value = '';
  F.name.value = a.name;
  F.w.value = a.w;
  F.q.value = a.q;
  F.h.value = a.h;
  F.d.value = a.d;
  F.duty.value = a.duty;
  F.room.value = a.room;
  clearErrors();
  refreshFormMode();
  $('#formCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  F.name.focus({ preventScroll: true });
}

$('#preset').addEventListener('change', e => {
  const p = PRESETS.find(x => x.id === e.target.value);
  if (!p) return;
  F.name.value = p.n[state.lang];
  F.w.value = p.w;
  F.h.value = p.h;
  F.d.value = p.d || 30;
  F.duty.value = p.duty || 100;
  F.room.value = p.r;
  formMeta = { icon: p.icon, pid: p.id };
  clearErrors();
});

$('#appForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!validate()) return;
  const item = {
    id: editingId || uid(),
    name: F.name.value.trim().slice(0, 40),
    icon: formMeta.icon || '🔌',
    pid: formMeta.pid || '',
    w: parseFloat(F.w.value),
    q: parseInt(F.q.value, 10),
    h: parseFloat(F.h.value),
    d: parseInt(F.d.value, 10),
    duty: parseFloat(F.duty.value),
    room: F.room.value,
  };
  if (editingId) {
    const i = state.appliances.findIndex(x => x.id === editingId);
    if (i >= 0) state.appliances[i] = item; else state.appliances.push(item);
    toast(t('t_saved'));
  } else {
    state.appliances.push(item);
    toast(t('t_added'));
  }
  resetForm();
  update();
});

$('#cancelEdit').addEventListener('click', resetForm);

/* ================= list ================= */
function renderList(items) {
  const list = $('#appList');
  const sorted = items.slice();
  if (sortKey === 'cost') sorted.sort((a, b) => b.cost - a.cost);
  else if (sortKey === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
  else sorted.reverse();

  list.innerHTML = sorted.map(a => `
    <li class="app-item" data-id="${esc(a.id)}">
      <div class="ai-icon" aria-hidden="true">${esc(a.icon)}</div>
      <div class="ai-main">
        <div class="ai-name">${esc(a.name)} <span class="tag">${esc(t('room_' + a.room))}</span></div>
        <div class="ai-spec">${esc(localize(`${nf(a.w)}W × ${a.q} · ${nf(a.h)}h/day · ${a.d} ${t('days_unit')} · ${nf(a.duty)}%`))}</div>
      </div>
      <div class="ai-nums"><b>${esc(money(a.cost))}</b><small>${esc(num(a.kwh, 1))} kWh</small></div>
      <div class="ai-btns no-print">
        <button type="button" class="mini" data-act="edit">✎ ${esc(t('btn_edit'))}</button>
        <button type="button" class="mini" data-act="dup">⧉ ${esc(t('btn_dup'))}</button>
        <button type="button" class="mini del" data-act="del">✕ ${esc(t('btn_del'))}</button>
      </div>
    </li>`).join('');

  const n = items.length;
  $('#count').textContent = t(n === 1 ? 'count_one' : 'count_many', { n: localize(n) });
  $('#empty').hidden = n > 0;
  $('#clearAll').hidden = n === 0;
}

$('#appList').addEventListener('click', e => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const li = btn.closest('.app-item');
  const id = li && li.dataset.id;
  const idx = state.appliances.findIndex(a => a.id === id);
  if (idx < 0) return;
  const act = btn.dataset.act;
  if (act === 'edit') startEdit(id);
  if (act === 'dup') {
    const src = state.appliances[idx];
    const copy = Object.assign({}, src, { id: uid(), name: (src.name + ' (2)').slice(0, 40) });
    state.appliances.splice(idx + 1, 0, copy);
    update();
  }
  if (act === 'del') {
    const removed = state.appliances.splice(idx, 1)[0];
    if (editingId === id) resetForm();
    update();
    toast(t('t_deleted'), { label: t('t_undo'), fn: () => { state.appliances.splice(Math.min(idx, state.appliances.length), 0, removed); update(); } });
  }
});

$('#clearAll').addEventListener('click', () => {
  if (!state.appliances.length) return;
  const backup = state.appliances.slice();
  state.appliances = [];
  resetForm();
  update();
  toast(t('t_cleared'), { label: t('t_undo'), fn: () => { state.appliances = backup; update(); } });
});

$('#sort').addEventListener('change', e => { sortKey = e.target.value; update(); });

/* ================= summary ================= */
function bdRow(label, value, cls) {
  return `<tr${cls ? ` class="${cls}"` : ''}><td>${esc(label)}</td><td>${esc(value)}</td></tr>`;
}

function bdHtml(units, b) {
  let h = bdRow(t('bd_energy', { n: num(units, 1) }), money(b.energy));
  b.parts.forEach(p => {
    const to = p.to === Infinity ? '∞' : nf(p.to);
    h += bdRow(`${nf(p.from)}–${to} kWh · ${num(p.units, 1)} × ${num(p.rate)}`, money(p.cost), 'sub');
  });
  if (b.fixed) h += bdRow(t('bd_fixed'), money(b.fixed));
  if (state.vat) h += bdRow(t('bd_vat', { p: nf(state.vat) }), money(b.vat));
  h += bdRow(t('bd_total'), money(b.total), 'total');
  return h;
}

function renderSummary(c) {
  const { total, bill } = c;
  const days = state.billingDays || 30;
  $('#curSym').textContent = sym();
  $('#billAmt').textContent = num(bill.total);
  $('#miniBill').textContent = money(bill.total);
  $('#stUnits').textContent = `${num(total, 1)} kWh`;
  $('#stPerDay').textContent = `${num(total / days)} kWh`;
  $('#stDaily').textContent = money(bill.total / days);
  $('#stYearly').textContent = money(bill.total * 12);
  $('#stCo2').textContent = `${num(total * CO2_FACTOR, 1)} kg`;
  $('#stAvg').textContent = total > 0 ? money(bill.total / total) : '—';
  $('#bdTable tbody').innerHTML = bdHtml(total, bill);

  const badge = $('#calibBadge');
  badge.hidden = !state.calibOn;
  if (state.calibOn) badge.textContent = t('calib_badge', { f: num(state.calib, 2) });

  const box = $('#budgetBox');
  if (state.budget > 0) {
    box.hidden = false;
    const pct = bill.total / state.budget;
    const fill = $('#budgetFill');
    fill.style.width = Math.min(100, pct * 100) + '%';
    fill.style.background = pct < 0.8 ? 'var(--good)' : (pct <= 1 ? 'var(--warn)' : 'var(--bad)');
    $('#budgetText').textContent = pct <= 1
      ? t('budget_left', { pct: nf(Math.round(pct * 100)), amt: money(state.budget - bill.total) })
      : t('budget_over', { amt: money(bill.total - state.budget) });
  } else {
    box.hidden = true;
  }
}

/* ================= charts ================= */
const PALETTE = ['#ffc93c', '#ff9f1c', '#3ddc97', '#4cc9f0', '#8e7dff', '#ff5d8f', '#6ee7b7', '#94a3b8'];
let chartApp = null, chartRoom = null;

function destroyCharts() {
  if (chartApp) { chartApp.destroy(); chartApp = null; }
  if (chartRoom) { chartRoom.destroy(); chartRoom = null; }
}

function renderCharts(items) {
  const has = items.some(i => i.kwh > 0);
  const cardApp = $('#chartApp').closest('.card');
  const cardRoom = $('#chartRoom').closest('.card');
  const noChart = typeof Chart === 'undefined';
  const show = has && !noChart;
  cardApp.classList.toggle('no-data', !show);
  cardRoom.classList.toggle('no-data', !show);
  const msg = has && noChart ? t('chart_offline') : t('chart_empty');
  $('#emptyApp').textContent = msg;
  $('#emptyRoom').textContent = msg;
  if (!show) { destroyCharts(); return; }

  destroyCharts();
  const css = getComputedStyle(document.documentElement);
  const muted = css.getPropertyValue('--muted').trim();
  const border = css.getPropertyValue('--border').trim();
  const card = css.getPropertyValue('--card').trim();
  Chart.defaults.color = muted;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

  // cost by appliance: top 6 + others
  const byCost = items.filter(i => i.cost > 0).sort((a, b) => b.cost - a.cost);
  const top = byCost.slice(0, 6);
  const others = byCost.slice(6).reduce((s, i) => s + i.cost, 0);
  const labels = top.map(i => i.name);
  const data = top.map(i => +i.cost.toFixed(2));
  if (others > 0) { labels.push(t('chart_others')); data.push(+others.toFixed(2)); }

  chartApp = new Chart($('#chartApp'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: PALETTE, borderColor: card, borderWidth: 2 }] },
    options: {
      maintainAspectRatio: false, cutout: '60%', animation: { duration: 300 },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${money(ctx.parsed)}` } },
      },
    },
  });

  // energy by room
  const rooms = ROOMS.map(r => ({ r, kwh: items.filter(i => i.room === r).reduce((s, i) => s + i.kwh, 0) })).filter(x => x.kwh > 0);
  chartRoom = new Chart($('#chartRoom'), {
    type: 'bar',
    data: {
      labels: rooms.map(x => t('room_' + x.r)),
      datasets: [{ data: rooms.map(x => +x.kwh.toFixed(2)), backgroundColor: rooms.map((x, i) => PALETTE[i % PALETTE.length]), borderRadius: 8 }],
    },
    options: {
      maintainAspectRatio: false, animation: { duration: 300 },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${num(ctx.parsed.y, 1)} kWh` } } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: border } },
      },
    },
  });
}

/* ================= insights ================= */
function renderInsights(c) {
  const ul = $('#insightList');
  const out = [];
  const { items, total, bill } = c;

  if (!items.length || total <= 0) {
    out.push({ cls: '', text: t('ins_empty') });
  } else {
    const sorted = items.slice().sort((a, b) => b.cost - a.cost);
    const top = sorted[0];
    const pct = Math.round(top.cost / bill.total * 100);
    out.push({ cls: '', text: t('ins_top', { name: top.name, pct: nf(pct), amt: money(top.cost) }) });

    if (top.h > 0) {
      const cut = top.h > 1 ? 1 : top.h / 2;
      const altKwh = state.appliances.reduce((s, a) => s + itemKwh(a.id === top.id ? Object.assign({}, a, { h: a.h - cut }) : a), 0);
      const saving = bill.total - billFor(altKwh).total;
      if (saving > 0) {
        const cutLabel = cut >= 1 ? `${nf(cut)} ${t('u_h')}` : `${nf(Math.round(cut * 60))} ${t('u_min')}`;
        out.push({ cls: 'good', text: t('ins_whatif', { name: top.name, cut: cutLabel, amt: money(saving) }) });
      }
    }

    out.push({ cls: '', text: t('ins_year', { amt: money(bill.total * 12) }) });
    out.push({ cls: '', text: t('ins_co2', { kg: num(total * CO2_FACTOR, 1) }) });

    if (state.mode === 'slab' && bill.parts.length) {
      out.push({ cls: '', text: t('ins_slab', { rate: money(bill.parts[bill.parts.length - 1].rate) }) });
    }
    if (state.budget > 0) {
      out.push(bill.total <= state.budget
        ? { cls: 'good', text: t('ins_budget_ok', { amt: money(state.budget - bill.total) }) }
        : { cls: 'bad', text: t('ins_budget_over', { amt: money(bill.total - state.budget) }) });
    }
    const pids = new Set(items.map(i => i.pid));
    if ([...pids].some(p => /^ac/.test(p))) out.push({ cls: '', text: t('ins_ac') });
    if (pids.has('inc') || pids.has('cfl')) out.push({ cls: '', text: t('ins_inc') });
    if (pids.has('fridge')) out.push({ cls: '', text: t('ins_fridge') });
  }
  ul.innerHTML = out.map(i => `<li class="${i.cls}">${esc(i.text)}</li>`).join('');
}

/* ================= tools ================= */
function renderTools(c) {
  // meter reading
  const prev = toNum($('#mPrev').value);
  const curr = toNum($('#mCurr').value);
  const units = Math.max(0, curr - prev);
  const mb = billFor(units);
  $('#meterOut tbody').innerHTML = bdRow(t('m_units'), `${num(units, 1)} kWh`) + bdHtml(units, mb);

  // solar
  const size = Math.max(0, toNum($('#sSize').value));
  const sun = clamp(toNum($('#sSun').value), 0, 12);
  const pr = clamp(toNum($('#sPR').value), 0, 100);
  const costKw = Math.max(0, toNum($('#sCost').value));
  const gen = size * sun * (pr / 100) * 30;
  const base = c.total > 0 ? c.total : gen;
  const saving = billFor(base).total - billFor(Math.max(0, base - gen)).total;
  const sysCost = size * costKw;
  const payback = saving > 0 && sysCost > 0 ? sysCost / (saving * 12) : null;
  $('#solarOut tbody').innerHTML =
    bdRow(t('s_gen'), `${num(gen, 0)} kWh`) +
    bdRow(t('s_save'), money(saving)) +
    bdRow(t('s_cost'), money(sysCost)) +
    bdRow(t('s_payback'), payback ? t('s_years', { n: num(payback, 1) }) : t('s_na')) +
    bdRow(t('s_co2'), `${num(gen * 12 * CO2_FACTOR, 0)} kg`);
}

/* ================= v3 helpers ================= */
const currentMonth = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const moneyC = (n, cur) => (CURRENCIES[cur] ? CURRENCIES[cur].sym : sym()) + ' ' + num(n);
const signedMoney = n => (n >= 0 ? '+ ' : '− ') + money(Math.abs(n));
const signedPct = p => (p >= 0 ? '+' : '−') + num(Math.abs(p), 1) + '%';

function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  try {
    return localize(new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(
      state.lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }));
  } catch (e) { return localize(ym); }
}

function downloadCsv(rows, filename) {
  const q = v => '"' + String(v).replace(/"/g, '""') + '"';
  const csv = '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ================= actual vs estimated + calibration ================= */
// Finds the kWh that would produce a given bill (the tariff is monotonic, so bisection works).
function kwhForBill(target) {
  if (!(target > 0)) return 0;
  if (billFor(1e-9).total >= target) return 0;
  let lo = 0, hi = 1, guard = 0;
  while (billFor(hi).total < target && guard++ < 60) hi *= 2;
  if (billFor(hi).total < target) return NaN;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (billFor(mid).total < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function cmpCalc() {
  const c = compute();
  const raw = c.raw;
  const rawBill = billFor(raw).total;
  const actual = parseFloat($('#cActual').value);
  const uIn = parseFloat($('#cUnits').value);
  const hasActual = Number.isFinite(actual) && actual > 0;
  const hasUnits = Number.isFinite(uIn) && uIn > 0;
  let actualKwh = null, implied = false;
  if (hasUnits) actualKwh = uIn;
  else if (hasActual) {
    const k = kwhForBill(actual);
    if (Number.isFinite(k) && k > 0) { actualKwh = k; implied = true; }
  }
  const factor = raw > 0 && actualKwh ? actualKwh / raw : null;
  return { raw, rawBill, actual: hasActual ? actual : null, hasActual, actualKwh, implied, factor };
}

function renderCompare() {
  const r = cmpCalc();
  const rows = [];
  let verdict = '', vcls = '';
  const canApply = r.factor != null && r.factor >= CALIB_MIN && r.factor <= CALIB_MAX;

  if (!(r.raw > 0)) {
    verdict = t('cmp_need_app');
  } else if (!r.hasActual && !r.actualKwh) {
    verdict = t('cmp_enter');
  } else {
    rows.push(bdRow(t('cmp_est'), money(r.rawBill)));
    if (state.calibOn) rows.push(bdRow(t('cmp_est_cal'), money(billFor(r.raw * state.calib).total)));
    let pct = null;
    if (r.hasActual) {
      const diff = r.actual - r.rawBill;
      pct = r.rawBill > 0 ? diff / r.rawBill * 100 : null;
      rows.push(bdRow(t('cmp_act'), money(r.actual)));
      rows.push(bdRow(t('cmp_diff'), signedMoney(diff)));
      if (pct != null) rows.push(bdRow(t('cmp_pct'), signedPct(pct)));
    }
    rows.push(bdRow(t('cmp_est_units'), `${num(r.raw, 1)} kWh`));
    if (r.actualKwh) rows.push(bdRow(t(r.implied ? 'cmp_impl_units' : 'cmp_act_units'), `${num(r.actualKwh, 1)} kWh`));
    if (r.factor != null) {
      rows.push(bdRow(t('cmp_factor'), '× ' + num(r.factor, 2)));
      if (pct == null) pct = (r.factor - 1) * 100;
    }
    if (pct != null) {
      if (Math.abs(pct) <= 10) { verdict = t('cmp_v_close'); vcls = 'good'; }
      else if (!canApply) { verdict = t('cmp_v_far'); vcls = 'bad'; }
      else { verdict = t(pct > 0 ? 'cmp_v_under' : 'cmp_v_over'); vcls = 'warn'; }
    }
  }
  $('#cmpOut').innerHTML =
    (rows.length ? `<table class="bd"><tbody>${rows.join('')}</tbody></table>` : '') +
    (verdict ? `<p class="verdict ${vcls}">${esc(verdict)}</p>` : '');
  $('#cApply').disabled = !canApply;
  $('#cRemove').disabled = !state.calibOn;
}

$('#cMonth').addEventListener('input', e => {
  state.cmp.month = MONTH_RE.test(e.target.value) ? e.target.value : '';
  setErr(e.target, '');
  save();
});
[['cActual', 'actual'], ['cUnits', 'units']].forEach(([id, key]) => {
  $('#' + id).addEventListener('input', e => {
    state.cmp[key] = cleanNumStr(e.target.value);
    setErr(e.target, '');
    save();
    renderCompare();
  });
});

$('#cApply').addEventListener('click', () => {
  const r = cmpCalc();
  if (r.factor == null || r.factor < CALIB_MIN || r.factor > CALIB_MAX) return;
  state.calib = Math.round(r.factor * 1000) / 1000;
  state.calibOn = true;
  update();
  toast(t('t_calib_on', { f: num(state.calib, 2) }));
});

$('#cRemove').addEventListener('click', () => {
  state.calibOn = false;
  update();
  toast(t('t_calib_off'));
});

/* ================= monthly history ================= */
const histVal = e => (e.actual > 0 ? e.actual : e.est);
const sortHistory = () => state.history.sort((a, b) => a.month.localeCompare(b.month));
let chartHist = null;

function saveHistory() {
  const mEl = $('#cMonth');
  const month = mEl.value.trim();
  let ok = true;
  if (!MONTH_RE.test(month)) { setErr(mEl, t('err_month')); ok = false; } else setErr(mEl, '');
  const optional = el => {
    const raw = el.value.trim();
    if (raw === '') { setErr(el, ''); return 0; }
    const v = parseFloat(raw);
    if (!(v > 0)) { setErr(el, t('err_pos')); ok = false; return 0; }
    setErr(el, '');
    return v;
  };
  const actual = optional($('#cActual'));
  const akwh = optional($('#cUnits'));
  if (!ok) return;

  const c = compute();
  if (!(c.bill.total > 0) && !(actual > 0)) { toast(t('t_hist_nothing')); return; }
  const entry = {
    id: uid(), month, cur: state.currency,
    est: +c.bill.total.toFixed(2), actual: +actual.toFixed(2), kwh: +c.total.toFixed(2), akwh: +akwh.toFixed(2),
  };
  const idx = state.history.findIndex(e => e.month === month);
  if (idx >= 0) {
    entry.id = state.history[idx].id;
    state.history[idx] = entry;
    toast(t('t_hist_updated'));
  } else {
    if (state.history.length >= HIST_MAX) { toast(t('t_hist_full')); return; }
    state.history.push(entry);
    toast(t('t_hist_saved'));
  }
  sortHistory();
  update();
}

$('#cSave').addEventListener('click', saveHistory);

function renderHistory() {
  const desc = state.history.slice().sort((a, b) => b.month.localeCompare(a.month));
  const n = desc.length;
  $('#histCount').textContent = t(n === 1 ? 'hist_count_one' : 'hist_count_many', { n: localize(n) });
  $('#histEmpty').hidden = n > 0;
  $('#histCsv').hidden = n === 0;
  $('#histClear').hidden = n === 0;

  $('#histList').innerHTML = desc.map(e => `
    <li class="hist-item" data-id="${esc(e.id)}">
      <div class="hi-main">
        <b>${esc(monthLabel(e.month))}</b>
        <small>${esc(t('hist_kwh_est', { n: num(e.kwh, 1) }) + (e.akwh > 0 ? ` · ${num(e.akwh, 1)} kWh (${t('hist_act')})` : ''))}</small>
      </div>
      <div class="hi-nums">
        <span>${esc(t('hist_est'))}: ${esc(moneyC(e.est, e.cur))}</span>
        <span>${esc(t('hist_act'))}: ${esc(e.actual > 0 ? moneyC(e.actual, e.cur) : '—')}</span>
      </div>
      <button type="button" class="mini del" data-act="hdel" aria-label="${esc(t('btn_del'))}">✕</button>
    </li>`).join('');

  // stats and chart only use entries in the current currency (so amounts are comparable)
  const cur = state.history.filter(e => e.cur === state.currency);
  const vals = cur.map(histVal);
  const stats = [];
  if (cur.length) {
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    let hi = 0;
    vals.forEach((v, i) => { if (v > vals[hi]) hi = i; });
    let change = '—';
    if (vals.length > 1 && vals[vals.length - 2] > 0) {
      change = signedPct((vals[vals.length - 1] - vals[vals.length - 2]) / vals[vals.length - 2] * 100);
    }
    stats.push([t('hist_avg'), money(avg)]);
    stats.push([t('hist_high'), `${monthLabel(cur[hi].month)} · ${money(vals[hi])}`]);
    stats.push([t('hist_change'), change]);
  }
  const statBox = $('#histStats');
  statBox.hidden = stats.length === 0;
  statBox.innerHTML = stats.map(([l, v]) => `<div class="stat"><small>${esc(l)}</small><b>${esc(v)}</b></div>`).join('');

  const noLib = typeof Chart === 'undefined';
  const show = cur.length >= 2 && !noLib;
  $('#histCard').classList.toggle('no-data', !show);
  $('#emptyHist').hidden = n === 0;
  $('#emptyHist').textContent = cur.length >= 2 && noLib ? t('chart_offline') : t('hist_chart_empty');
  if (chartHist) { chartHist.destroy(); chartHist = null; }
  if (!show) return;

  const css = getComputedStyle(document.documentElement);
  Chart.defaults.color = css.getPropertyValue('--muted').trim();
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  const grid = css.getPropertyValue('--border').trim();
  const accent = css.getPropertyValue('--accent').trim() || '#ffc93c';
  chartHist = new Chart($('#chartHist'), {
    type: 'line',
    data: {
      labels: cur.map(e => monthLabel(e.month)),
      datasets: [
        { label: t('hist_est'), data: cur.map(e => e.est), borderColor: accent, backgroundColor: accent, tension: 0.25, pointRadius: 3 },
        { label: t('hist_act'), data: cur.map(e => (e.actual > 0 ? e.actual : null)), borderColor: '#3aa8d8', backgroundColor: '#3aa8d8', tension: 0.25, pointRadius: 3, spanGaps: true },
      ],
    },
    options: {
      maintainAspectRatio: false, animation: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${money(ctx.parsed.y)}` } },
      },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: grid } } },
    },
  });
}

$('#histList').addEventListener('click', e => {
  const btn = e.target.closest('button[data-act="hdel"]');
  if (!btn) return;
  const id = btn.closest('.hist-item').dataset.id;
  const idx = state.history.findIndex(h => h.id === id);
  if (idx < 0) return;
  const removed = state.history.splice(idx, 1)[0];
  update();
  toast(t('t_hist_deleted'), {
    label: t('t_undo'),
    fn: () => {
      if (state.history.some(h => h.month === removed.month)) return;
      state.history.push(removed);
      sortHistory();
      update();
    },
  });
});

$('#histClear').addEventListener('click', () => {
  if (!state.history.length) return;
  const backup = state.history.slice();
  state.history = [];
  update();
  toast(t('t_hist_cleared'), { label: t('t_undo'), fn: () => { state.history = backup; update(); } });
});

$('#histCsv').addEventListener('click', () => {
  if (!state.history.length) return;
  const rows = [['Month', 'Currency', 'Estimated bill', 'Actual bill', 'Estimated kWh', 'Actual kWh']];
  state.history.forEach(e => rows.push([e.month, e.cur, e.est.toFixed(2), e.actual > 0 ? e.actual.toFixed(2) : '', e.kwh.toFixed(2), e.akwh > 0 ? e.akwh.toFixed(2) : '']));
  downloadCsv(rows, 'smartwatt-history.csv');
  toast(t('t_csv'));
});

/* ================= bill splitter ================= */
const personName = (p, i) => p.name.trim() || t('split_person', { n: localize(i + 1) });

// Splits `total` by weights in whole cents (largest-remainder), so the parts add up exactly.
function allocate(total, weights) {
  const cents = Math.round(total * 100);
  const sum = weights.reduce((a, b) => a + b, 0);
  const w = sum > 0 ? weights : weights.map(() => 1);
  const s = sum > 0 ? sum : w.length;
  const raw = w.map(x => cents * x / s);
  const base = raw.map(Math.floor);
  const rem = cents - base.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, f: r - base[i] })).sort((a, b) => b.f - a.f || a.i - b.i);
  for (let k = 0; k < rem; k++) base[order[k % order.length].i]++;
  return base.map(c => c / 100);
}

function splitData(c) {
  const sp = state.split;
  const amt = parseFloat(sp.amount);
  const usingEst = !(amt > 0);
  const total = usingEst ? (c || compute()).bill.total : amt;
  const weights = sp.people.map(p => (sp.mode === 'share' ? Math.max(0, p.share) : sp.mode === 'meter' ? Math.max(0, p.curr - p.prev) : 1));
  const sum = weights.reduce((a, b) => a + b, 0);
  const fallback = sp.mode !== 'equal' && !(sum > 0);
  const amounts = total > 0 ? allocate(total, fallback ? weights.map(() => 1) : weights) : weights.map(() => 0);
  const rows = sp.people.map((p, i) => ({
    name: personName(p, i), amount: amounts[i], pct: total > 0 ? amounts[i] / total * 100 : 0, weight: weights[i],
  }));
  return { total, usingEst, fallback, rows, mode: sp.mode };
}

function renderSplitRows() {
  const sp = state.split;
  const mode = sp.mode;
  $('#spMode').value = mode;
  $('#spAmount').value = sp.amount;
  const head = mode === 'equal' ? '' :
    `<div class="sp-row sp-head m-${mode}"><span class="sp-name">${esc(t('split_name'))}</span>` +
    (mode === 'share'
      ? `<span>${esc(t('split_share_lbl'))}</span>`
      : `<span>${esc(t('split_prev'))}</span><span>${esc(t('split_curr'))}</span>`) +
    '<span class="sp-x"></span></div>';
  const numInput = (k, v, label) =>
    `<input type="number" min="0" step="any" inputmode="decimal" data-k="${k}" value="${v}" aria-label="${esc(label)}">`;
  $('#spRows').innerHTML = head + sp.people.map((p, i) => `
    <div class="sp-row m-${mode}" data-id="${esc(p.id)}">
      <input class="sp-name" type="text" maxlength="24" data-k="name" value="${esc(p.name)}" placeholder="${esc(t('split_person', { n: localize(i + 1) }))}" aria-label="${esc(t('split_name') + ' ' + localize(i + 1))}">
      ${mode === 'share' ? numInput('share', p.share, t('split_share_lbl')) : ''}
      ${mode === 'meter' ? numInput('prev', p.prev, t('split_prev')) + numInput('curr', p.curr, t('split_curr')) : ''}
      <button type="button" class="mini del" data-act="rm" aria-label="${esc(t('split_remove'))}"${sp.people.length <= SPLIT_MIN ? ' disabled' : ''}>✕</button>
    </div>`).join('');
  $('#spAdd').disabled = sp.people.length >= SPLIT_MAX;
}

function renderSplitOut(c) {
  const d = splitData(c);
  const rows = [];
  if (d.total > 0) {
    d.rows.forEach(r => {
      const extra = d.mode === 'meter' ? ` · ${num(r.weight, 1)} kWh` : d.mode === 'share' ? ` · ×${nf(r.weight)}` : '';
      rows.push(bdRow(`${r.name}${extra} · ${num(r.pct, 1)}%`, money(r.amount)));
    });
    rows.push(bdRow(t('bd_total'), money(d.total), 'total'));
  }
  $('#spOut tbody').innerHTML = rows.join('');
  $('#spNote').textContent = d.total > 0
    ? (d.fallback ? t('split_fallback') : t(d.usingEst ? 'split_using_est' : 'split_using_amt'))
    : t('split_zero');
}

$('#spMode').addEventListener('change', e => {
  state.split.mode = SPLIT_MODES.includes(e.target.value) ? e.target.value : 'equal';
  renderSplitRows();
  renderSplitOut();
  save();
});

$('#spAmount').addEventListener('input', e => {
  state.split.amount = cleanNumStr(e.target.value);
  renderSplitOut();
  save();
});

$('#spRows').addEventListener('input', e => {
  const inp = e.target.closest('input[data-k]');
  if (!inp) return;
  const p = state.split.people.find(x => x.id === inp.closest('.sp-row').dataset.id);
  if (!p) return;
  const k = inp.dataset.k;
  if (k === 'name') p.name = inp.value.slice(0, 24);
  else if (k === 'share') p.share = clamp(toNum(inp.value), 0, 1000);
  else p[k] = Math.max(0, toNum(inp.value));
  renderSplitOut();
  save();
});

$('#spRows').addEventListener('click', e => {
  const btn = e.target.closest('button[data-act="rm"]');
  if (!btn || btn.disabled || state.split.people.length <= SPLIT_MIN) return;
  const id = btn.closest('.sp-row').dataset.id;
  state.split.people = state.split.people.filter(p => p.id !== id);
  renderSplitRows();
  renderSplitOut();
  save();
});

$('#spAdd').addEventListener('click', () => {
  if (state.split.people.length >= SPLIT_MAX) return;
  state.split.people.push(newPerson());
  renderSplitRows();
  renderSplitOut();
  save();
});

$('#spCopy').addEventListener('click', async () => {
  const d = splitData();
  if (!(d.total > 0)) { toast(t('split_zero')); return; }
  const lines = [`${t('split_summary_head')} — ${money(d.total)}`];
  d.rows.forEach(r => lines.push(`${r.name}: ${money(r.amount)}`));
  const text = lines.join('\n');
  try {
    await navigator.clipboard.writeText(text);
    toast(t('t_split_copied'));
  } catch (e) {
    window.prompt(t('copy_prompt'), text);
  }
});

/* ================= PDF report (uses the browser's "Save as PDF") ================= */
function buildReport() {
  const c = compute();
  const days = state.billingDays || 30;
  const now = new Date();
  let dateStr;
  try {
    dateStr = localize(now.toLocaleDateString(state.lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }));
  } catch (e) { dateStr = now.toISOString().slice(0, 10); }

  const tile = (l, v, cls) => `<div class="rp-tile${cls ? ' ' + cls : ''}"><small>${esc(l)}</small><b>${esc(v)}</b></div>`;
  const kv = (k, v) => `<tr><td>${esc(k)}</td><td class="r">${esc(v)}</td></tr>`;
  const items = c.items.slice().sort((a, b) => b.cost - a.cost);

  // tariff & charges
  const tar = [];
  if (state.mode === 'flat') tar.push(kv(t('unit_price'), money(state.rate)));
  else {
    tar.push(kv(t('mode_slab'), ''));
    let prev = 0;
    state.slabs.forEach((s, i) => {
      const last = i === state.slabs.length - 1;
      tar.push(kv(last ? t('slab_above', { n: nf(prev) }) : `${nf(prev)}–${nf(s.upto)} kWh`, `${money(s.rate)} / kWh`));
      if (!last) prev = s.upto;
    });
  }
  tar.push(kv(t('vat'), nf(state.vat)));
  if (state.fixed) tar.push(kv(t('fixed'), money(state.fixed)));
  tar.push(kv(t('billing_days'), localize(days)));
  if (state.calibOn) tar.push(kv(t('calib_badge', { f: num(state.calib, 2) }), ''));

  const appRows = items.map(a => `<tr>
    <td>${esc(a.icon)} ${esc(a.name)}</td><td>${esc(t('room_' + a.room))}</td>
    <td>${esc(localize(`${nf(a.w)}W × ${a.q}`))}</td>
    <td>${esc(localize(`${nf(a.h)}h × ${a.d} ${t('days_unit')}${a.duty < 100 ? ' · ' + nf(a.duty) + '%' : ''}`))}</td>
    <td class="r">${esc(num(a.kwh, 1))}</td><td class="r">${esc(money(a.cost))}</td></tr>`).join('');

  const bars = rows => rows.map(r => `<div class="rp-bar"><div class="rp-bar-l"><span>${esc(r.label)}</span><b>${esc(r.val)}</b></div><div class="rp-bar-t"><i style="width:${Math.max(1, Math.min(100, r.pct)).toFixed(1)}%"></i></div></div>`).join('');
  const costBars = items.filter(i => i.cost > 0).slice(0, 8).map(i => {
    const pct = c.bill.total > 0 ? i.cost / c.bill.total * 100 : 0;
    return { label: i.name, pct, val: `${money(i.cost)} (${num(pct, 0)}%)` };
  });
  const roomBars = ROOMS
    .map(r => ({ r, kwh: items.filter(i => i.room === r).reduce((s, i) => s + i.kwh, 0) }))
    .filter(x => x.kwh > 0).sort((a, b) => b.kwh - a.kwh)
    .map(x => {
      const pct = c.total > 0 ? x.kwh / c.total * 100 : 0;
      return { label: t('room_' + x.r), pct, val: `${num(x.kwh, 1)} kWh (${num(pct, 0)}%)` };
    });

  const insights = $$('#insightList li').map(li => `<li>${esc(li.textContent)}</li>`).join('');

  const cmpHtml = $('#cmpOut table') ? `<h2>${esc(t('cmp_title'))}</h2>${$('#cmpOut').innerHTML}` : '';

  const hist = state.history.slice().sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12);
  const histHtml = hist.length ? `<h2>${esc(t('rep_history_h'))}</h2><table><thead><tr><th></th><th class="r">${esc(t('hist_est'))}</th><th class="r">${esc(t('hist_act'))}</th></tr></thead><tbody>${
    hist.map(e => `<tr><td>${esc(monthLabel(e.month))}</td><td class="r">${esc(moneyC(e.est, e.cur))}</td><td class="r">${esc(e.actual > 0 ? moneyC(e.actual, e.cur) : '—')}</td></tr>`).join('')
  }</tbody></table>` : '';

  const sd = splitData(c);
  const splitHtml = sd.total > 0 ? `<h2>${esc(t('split_title'))}</h2><table class="bd"><tbody>${
    sd.rows.map(r => bdRow(`${r.name} · ${num(r.pct, 1)}%`, money(r.amount))).join('') + bdRow(t('bd_total'), money(sd.total), 'total')
  }</tbody></table>` : '';

  return `<div class="rp">
    <div class="rp-head">
      <div class="rp-brand">⚡ Smart<em>Watt</em></div>
      <div><div class="rp-title">${esc(t('rep_title'))}</div><div class="rp-date">${esc(t('rep_generated', { d: dateStr }))}</div></div>
    </div>
    <div class="rp-tiles">
      ${tile(t('est_bill'), money(c.bill.total), 'big')}
      ${tile(t('total_units'), num(c.total, 1) + ' kWh')}
      ${tile(t('per_day'), num(c.total / days) + ' kWh')}
      ${tile(t('daily_cost'), money(c.bill.total / days))}
      ${tile(t('yearly'), money(c.bill.total * 12))}
      ${tile(t('co2'), num(c.total * CO2_FACTOR, 1) + ' kg')}
      ${tile(t('avg_rate'), c.total > 0 ? money(c.bill.total / c.total) : '—')}
    </div>
    <div class="rp-cols">
      <div><h2>${esc(t('rep_tariff_h'))}</h2><table><tbody>${tar.join('')}</tbody></table></div>
      <div><h2>${esc(t('breakdown'))}</h2><table class="bd"><tbody>${bdHtml(c.total, c.bill)}</tbody></table></div>
    </div>
    <h2>${esc(t('rep_appliances_h'))}</h2>
    <table><thead><tr><th>${esc(t('rep_col_name'))}</th><th>${esc(t('rep_col_room'))}</th><th>${esc(t('rep_col_load'))}</th><th>${esc(t('rep_col_usage'))}</th><th class="r">${esc(t('rep_col_kwh'))}</th><th class="r">${esc(t('rep_col_cost'))}</th></tr></thead><tbody>${appRows}</tbody></table>
    <div class="rp-cols">
      <div><h2>${esc(t('chart_app'))}</h2>${bars(costBars)}</div>
      <div><h2>${esc(t('chart_room'))}</h2>${bars(roomBars)}</div>
    </div>
    <h2>${esc(t('insights'))}</h2><ul>${insights}</ul>
    ${cmpHtml}${histHtml}${splitHtml}
    <div class="rp-foot"><span>${esc(t('footer_disclaimer'))}</span><span>${esc(t('created_by'))} Taioba, Jakia, Faysal</span></div>
  </div>`;
}

function clearReportMode() {
  document.body.classList.remove('printing-report');
  $('#report').innerHTML = '';
}

$('#pdfBtn').addEventListener('click', () => {
  if (!state.appliances.length) { toast(t('t_empty_export')); return; }
  const prevTitle = document.title;
  $('#report').innerHTML = buildReport();
  document.title = 'SmartWatt-Report-' + new Date().toISOString().slice(0, 10);
  document.body.classList.add('printing-report');
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    clearReportMode();
    document.title = prevTitle;
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  setTimeout(done, 120000); // safety net for browsers that never fire afterprint
  toast(t('t_pdf_hint'));
  setTimeout(() => window.print(), 80);
});

/* ================= master update ================= */
function update() {
  const c = compute();
  renderSummary(c);
  renderList(c.items);
  renderCharts(c.items);
  renderInsights(c);
  renderTools(c);
  renderCompare();
  renderHistory();
  renderSplitOut(c);
  save();
}

/* ================= settings events ================= */
$('#currency').addEventListener('change', e => {
  state.currency = e.target.value;
  state.rate = CURRENCIES[state.currency].rate;
  renderSettings();
  suggestSolarCost();
  update();
});

$$('.seg-b').forEach(b => b.addEventListener('click', () => {
  state.mode = b.dataset.mode;
  renderSettings();
  update();
}));

[['rate', 'rate'], ['vat', 'vat'], ['fixed', 'fixed'], ['billingDays', 'billingDays'], ['budget', 'budget']].forEach(([id, key]) => {
  $('#' + id).addEventListener('input', e => {
    let v = Math.max(0, toNum(e.target.value));
    if (key === 'billingDays') v = clamp(Math.round(v) || 30, 1, 31);
    if (key === 'vat') v = Math.min(v, 100);
    state[key] = v;
    if (key === 'rate') $$('.chip').forEach(ch => ch.classList.remove('on'));
    update();
  });
});

$('#slabRows').addEventListener('input', e => {
  const inp = e.target.closest('input[data-i]');
  if (!inp) return;
  const i = parseInt(inp.dataset.i, 10);
  const k = inp.dataset.k;
  if (!state.slabs[i]) return;
  state.slabs[i][k] = Math.max(0, toNum(inp.value));
  updateAboveLabel();
  update();
});

$('#slabReset').addEventListener('click', () => {
  state.slabs = DEFAULT_SLABS();
  renderSlabs();
  update();
});

['mPrev', 'mCurr', 'sSize', 'sSun', 'sPR', 'sCost'].forEach(id => {
  $('#' + id).addEventListener('input', () => {
    if (id === 'sCost') solarDirty = true;
    renderTools(compute());
  });
});

/* ================= export / print / share ================= */
$('#csvBtn').addEventListener('click', () => {
  if (!state.appliances.length) { toast(t('t_empty_export')); return; }
  const c = compute();
  const rows = [['Appliance','Room', 'Watt', 'Qty', 'Hours/day', 'Days/month', 'Duty %', 'kWh/month', `Cost (${state.currency})`]];
  c.items.forEach(a => rows.push([a.name, a.room, a.w, a.q, a.h, a.d, a.duty, a.kwh.toFixed(2), a.cost.toFixed(2)]));
  rows.push([]);
  rows.push(['Total kWh', '', '', '', '', '', '', c.total.toFixed(2), '']);
  rows.push(['Energy charge', '', '', '', '', '', '', '', c.bill.energy.toFixed(2)]);
  rows.push(['Fixed charge', '', '', '', '', '', '', '', c.bill.fixed.toFixed(2)]);
  rows.push([`VAT ${state.vat}%`, '', '', '', '', '', '', '', c.bill.vat.toFixed(2)]);
  rows.push(['Total bill', '', '', '', '', '', '', '', c.bill.total.toFixed(2)]);
  downloadCsv(rows, 'smartwatt-bill.csv');
  toast(t('t_csv'));
});

$('#printBtn').addEventListener('click', () => { clearReportMode(); window.print(); });

function encodeState() {
  // personal data (history, last comparison, splitter) is never put in a share link
  const payload = Object.assign({}, state, { lang: undefined, theme: undefined, history: undefined, cmp: undefined, split: undefined });
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeState(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

$('#shareBtn').addEventListener('click', async () => {
  const link = location.origin + location.pathname + '#s=' + encodeState();
  try {
    await navigator.clipboard.writeText(link);
    toast(t('t_copied'));
  } catch (e) {
    window.prompt(t('copy_prompt'), link);
  }
});

/* ================= theme, language, menu, install ================= */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  $('#themeBtn').textContent = state.theme === 'dark' ? '☀️' : '🌙';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', state.theme === 'dark' ? '#0a0f1e' : '#f4f6fb');
}

$('#themeBtn').addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  update();
});

function refreshLanguage() {
  applyI18n();
  buildPresetSelect();
  buildRoomSelect();
  renderSlabs();
  renderChips();
  renderSplitRows();
  refreshFormMode();
  update();
}

$('#langBtn').addEventListener('click', () => {
  state.lang = state.lang === 'en' ? 'bn' : 'en';
  refreshLanguage();
});

$('#menuBtn').addEventListener('click', () => {
  const nav = $('#navLinks');
  const open = nav.classList.toggle('open');
  $('#menuBtn').setAttribute('aria-expanded', open ? 'true' : 'false');
});
$$('#navLinks a').forEach(a => a.addEventListener('click', () => {
  $('#navLinks').classList.remove('open');
  $('#menuBtn').setAttribute('aria-expanded', 'false');
}));

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall = e;
  $('#installBtn').hidden = false;
});
$('#installBtn').addEventListener('click', async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  try { await deferredInstall.userChoice; } catch (e) { /* ignore */ }
  deferredInstall = null;
  $('#installBtn').hidden = true;
});
window.addEventListener('appinstalled', () => { $('#installBtn').hidden = true; });

/* ================= feedback form (Netlify Forms) ================= */
$('#feedbackForm').addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target;
  fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(new FormData(form)).toString(),
  }).then(r => {
    if (!r.ok) throw new Error('bad status');
    form.reset();
    toast(t('t_sent'));
  }).catch(() => toast(t('t_send_fail')));
});

/* ================= init ================= */
function init() {
  // shared link?
  let loadedShared = false;
  if (location.hash.startsWith('#s=')) {
    try {
      const shared = sanitize(decodeState(location.hash.slice(3)), defaults());
      shared.lang = state.lang;
      shared.theme = state.theme;
      // keep this visitor's own history / comparison / splitter – a link only carries appliances + tariff
      shared.history = state.history;
      shared.cmp = state.cmp;
      shared.split = state.split;
      state = shared;
      loadedShared = true;
    } catch (e) { /* ignore bad link */ }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
  }

  applyTheme();
  buildRoomSelect();
  buildPresetSelect();
  applyI18n();
  renderSettings();
  renderSlabs();
  resetForm();
  $('#sCost').value = CURRENCIES[state.currency].solar;
  $('#cMonth').value = state.cmp.month || currentMonth();
  $('#cActual').value = state.cmp.actual;
  $('#cUnits').value = state.cmp.units;
  renderSplitRows();
  update();
  if (loadedShared) toast(t('t_loaded'));

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* ignore */ });
  }
}

init();
})();
