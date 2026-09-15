(function () {
  "use strict";

  const STORAGE_KEY = "qaras.schoolVisit.records.v2";
  const LEGACY_KEY = "qaras.schoolVisit.records.v1";
  const app = document.getElementById("app");
  const criteria = Array.isArray(window.QARAS_CRITERIA) ? window.QARAS_CRITERIA : [];
  const stages = [
    { key: "planning", label: "الزيارة التخطيطية", short: "التخطيطية" },
    { key: "midyear", label: "المراجعة النصف سنوية", short: "النصف سنوية" },
    { key: "evaluation", label: "الزيارة التقييمية", short: "التقييمية" }
  ];
  const steps = ["بيانات المدرسة", "مؤشرات المدرسة", "عناصر التقييم", "الأهداف والتوقيع", "المراجعة والطباعة"];
  let records = loadRecords();
  let currentRecord = null;
  let currentStep = 0;
  let activeStage = "planning";
  let currentCriterion = 0;
  let searchQuery = "";
  let savedTimer = null;
  let currentPrintRecord = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function loadRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY) || "[]";
      return JSON.parse(raw).map(normalizeRecord);
    } catch (_) {
      return [];
    }
  }

  function emptyVisit() {
    return {
      visitDay: "",
      visitDate: "",
      ratings: {},
      goals: Array(10).fill(""),
      principalName: "",
      supervisorName: "",
      principalSignature: "",
      supervisorSignature: ""
    };
  }

  function normalizeRecord(record) {
    const normalized = {
      id: record.id || makeId(),
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: record.updatedAt || new Date().toISOString(),
      status: record.status || "draft",
      schoolName: "",
      ministryNumber: "",
      email: "",
      stage: "",
      gender: "",
      schoolType: "",
      independence: "",
      directorName: "",
      jobTitle: "",
      mobile: "",
      civilId: "",
      directorExperience: "",
      currentSchoolExperience: "",
      performance1446: "",
      performance1447: "",
      studentsTotal: "",
      studentsAbsent: "",
      classesTotal: "",
      supervisorsTotal: "",
      supervisorsAbsent: "",
      adminsTotal: "",
      adminsAbsent: "",
      teachersTotal: "",
      teachersAbsent: "",
      schoolEvaluation: "",
      schoolPerformance2025: "",
      managementPerformance2025: "",
      schoolPerformance2026: "",
      managementPerformance2026: "",
      nafisThird: "",
      nafisSixth: "",
      nafisMiddle: "",
      achievementScientificSchool: "",
      achievementScientificOffice: "",
      achievementTheoreticalSchool: "",
      achievementTheoreticalOffice: "",
      aptitudeScientificSchool: "",
      aptitudeScientificOffice: "",
      aptitudeTheoreticalSchool: "",
      aptitudeTheoreticalOffice: "",
      deputyAcademic: "",
      deputySchool: "",
      deputyStudents: "",
      notes: "",
      ...record,
      visits: {
        planning: { ...emptyVisit(), ...(record.visits?.planning || {}) },
        midyear: { ...emptyVisit(), ...(record.visits?.midyear || {}) },
        evaluation: { ...emptyVisit(), ...(record.visits?.evaluation || {}) }
      }
    };
    stages.forEach(({ key }) => {
      normalized.visits[key].goals = Array.from({ length: 10 }, (_, index) => normalized.visits[key].goals?.[index] || "");
      normalized.visits[key].ratings ||= {};
    });
    return normalized;
  }

  function makeId() {
    return globalThis.crypto?.randomUUID?.() || `record-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function newRecord() {
    return normalizeRecord({ id: makeId(), createdAt: new Date().toISOString() });
  }

  function saveRecords() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function saveCurrent() {
    if (!currentRecord) return;
    currentRecord.updatedAt = new Date().toISOString();
    currentRecord.status = totalCompletion(currentRecord) === 100 ? "complete" : "draft";
    const index = records.findIndex((record) => record.id === currentRecord.id);
    if (index >= 0) records[index] = currentRecord;
    else records.unshift(currentRecord);
    saveRecords();
    const indicator = document.getElementById("saveIndicator");
    if (indicator) {
      indicator.textContent = "تم الحفظ محليًا";
      indicator.classList.add("saved");
      clearTimeout(savedTimer);
      savedTimer = setTimeout(() => indicator.classList.remove("saved"), 1200);
    }
  }

  function stageCompletion(record, stageKey) {
    const visit = record.visits[stageKey];
    const ratings = Object.values(visit.ratings || {}).filter((value) => Number(value) >= 1).length;
    const extras = [visit.supervisorName, visit.principalName || record.directorName].filter(Boolean).length;
    return Math.round(((ratings + extras) / (criteria.length + 2)) * 100);
  }

  function totalCompletion(record) {
    const base = [record.schoolName, record.ministryNumber, record.directorName].filter(Boolean).length;
    const visitsTotal = stages.reduce((sum, stage) => sum + stageCompletion(record, stage.key), 0);
    return Math.min(100, Math.round((base / 3) * 15 + (visitsTotal / 300) * 85));
  }

  function latestStage(record) {
    const completed = stages.filter((stage) => Object.keys(record.visits[stage.key].ratings || {}).length);
    return completed.at(-1)?.key || "planning";
  }

  function scoreFor(record, stageKey) {
    return criteria.reduce((total, criterion) => {
      const rating = Number(record.visits[stageKey].ratings?.[criterion.id] || 0);
      return total + (rating / 5) * criterion.weight;
    }, 0);
  }

  function scoreLabel(score) {
    if (score >= 90) return "مثالي";
    if (score >= 80) return "تخطى التوقعات";
    if (score >= 70) return "وافق التوقعات";
    if (score >= 60) return "بحاجة إلى تطوير";
    return score > 0 ? "غير مرضي" : "لم يكتمل التقييم";
  }

  function renderDashboard() {
    currentRecord = null;
    document.body.classList.remove("editor-open");
    const filtered = records.filter((record) => {
      const haystack = `${record.schoolName} ${record.ministryNumber}`.toLowerCase();
      return haystack.includes(searchQuery.toLowerCase());
    });
    const complete = records.filter((record) => record.status === "complete").length;
    app.innerHTML = `
      <section class="dashboard" aria-labelledby="dashboardTitle">
        <div class="dashboard-heading">
          <div><span class="eyebrow">السجلات المحفوظة على هذا الجهاز</span><h2 id="dashboardTitle">الزيارات الفنية</h2></div>
          <button class="primary-button" type="button" data-action="new-record"><span aria-hidden="true">＋</span> استمارة جديدة</button>
        </div>
        <label class="search-field"><span class="sr-only">البحث باسم المدرسة</span><span aria-hidden="true">⌕</span><input id="recordSearch" type="search" value="${escapeHtml(searchQuery)}" placeholder="ابحث باسم المدرسة أو الرقم الوزاري"></label>
        <div class="summary-strip" role="group" aria-label="ملخص السجلات">
          <div><strong>${records.length}</strong><span>سجل محفوظ</span></div>
          <div><strong>${complete}</strong><span>مكتمل</span></div>
          <div><strong>${records.length - complete}</strong><span>قيد الإكمال</span></div>
        </div>
        <div class="record-list">${filtered.length ? filtered.map(recordCard).join("") : emptyState()}</div>
      </section>`;
    document.getElementById("recordSearch")?.addEventListener("input", (event) => {
      searchQuery = event.target.value;
      renderDashboard();
      const input = document.getElementById("recordSearch");
      input?.focus();
      input?.setSelectionRange(searchQuery.length, searchQuery.length);
    });
  }

  function emptyState() {
    return `<section class="empty-state"><div class="empty-mark" aria-hidden="true">＋</div><h3>${records.length ? "لا توجد نتائج مطابقة" : "ابدأ أول زيارة فنية"}</h3><p>${records.length ? "جرّب البحث باسم آخر أو الرقم الوزاري." : "أدخل بيانات المدرسة مرة واحدة، ثم أكمل مراحل الزيارة واحفظها واطبعها من الجوال."}</p>${records.length ? "" : '<button class="primary-button wide" type="button" data-action="new-record">إنشاء استمارة</button>'}</section>`;
  }

  function recordCard(record) {
    const completion = totalCompletion(record);
    return `<article class="record-card">
      <div class="record-main">
        <div class="school-avatar" aria-hidden="true">${escapeHtml((record.schoolName || "م").trim().charAt(0))}</div>
        <div class="record-copy"><h3>${escapeHtml(record.schoolName || "استمارة جديدة")}</h3><p>${record.ministryNumber ? `الرقم الوزاري: ${escapeHtml(record.ministryNumber)}` : "لم يُدخل الرقم الوزاري بعد"}</p></div>
        <span class="completion-badge">${completion}%</span>
      </div>
      <div class="stage-statuses">${stages.map((stage) => `<span class="stage-pill ${stageCompletion(record, stage.key) === 100 ? "done" : ""}">${stage.short} ${stageCompletion(record, stage.key)}%</span>`).join("")}</div>
      <div class="progress-track" role="progressbar" aria-label="اكتمال الاستمارة" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${completion}"><span style="width:${completion}%"></span></div>
      <div class="record-actions">
        <button class="primary-button" type="button" data-action="edit-record" data-id="${record.id}">فتح وتعديل</button>
        <button class="secondary-button" type="button" data-action="print-record" data-id="${record.id}">طباعة</button>
        <button class="ghost-button danger" type="button" data-action="delete-record" data-id="${record.id}" aria-label="حذف ${escapeHtml(record.schoolName || "الاستمارة")}">حذف</button>
      </div>
      <p class="record-date">آخر حفظ: ${new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(record.updatedAt))}</p>
    </article>`;
  }

  function openRecord(record) {
    currentRecord = normalizeRecord(record);
    currentStep = 0;
    activeStage = latestStage(currentRecord);
    currentCriterion = 0;
    renderEditor();
  }

  function renderEditor() {
    if (!currentRecord) return renderDashboard();
    document.body.classList.add("editor-open");
    app.innerHTML = `<section class="editor">
      <div class="editor-header">
        <button class="back-button" type="button" data-action="dashboard" aria-label="العودة إلى السجلات">←</button>
        <div><span class="eyebrow">${escapeHtml(currentRecord.schoolName || "استمارة جديدة")}</span><h2>${steps[currentStep]}</h2></div>
        <span id="saveIndicator" class="save-indicator">حفظ تلقائي</span>
      </div>
      <nav class="stepper" aria-label="خطوات الاستمارة">${steps.map((step, index) => `<button type="button" class="step ${index === currentStep ? "active" : ""} ${index < currentStep ? "passed" : ""}" data-action="step" data-step="${index}"><span>${index + 1}</span><b>${step}</b></button>`).join("")}</nav>
      <form id="visitForm" class="form-panel" autocomplete="on">${renderStep()}</form>
      <div class="editor-footer">
        <button class="secondary-button" type="button" data-action="previous-step" ${currentStep === 0 ? "disabled" : ""}>السابق</button>
        <span>${currentStep + 1} من ${steps.length}</span>
        ${currentStep < steps.length - 1 ? '<button class="primary-button" type="button" data-action="next-step">التالي</button>' : '<button class="primary-button" type="button" data-action="print-current">طباعة أو حفظ PDF</button>'}
      </div>
    </section>`;
    initSignaturePads();
    document.querySelector(".editor")?.scrollIntoView({ block: "start" });
  }

  function renderStep() {
    if (currentStep === 0) return generalStep();
    if (currentStep === 1) return performanceStep();
    if (currentStep === 2) return criteriaStep();
    if (currentStep === 3) return goalsStep();
    return reviewStep();
  }

  function field(label, key, options = {}) {
    const value = currentRecord[key] || "";
    const required = options.required ? '<span class="required">مطلوب</span>' : "";
    if (options.type === "select") {
      return `<label class="field"><span>${label}${required}</span><select data-field="${key}"><option value="">اختر</option>${options.options.map((option) => `<option value="${escapeHtml(option)}" ${value === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></label>`;
    }
    return `<label class="field ${options.full ? "full" : ""}"><span>${label}${required}</span><input data-field="${key}" type="${options.inputType || "text"}" value="${escapeHtml(value)}" inputmode="${options.inputMode || "text"}" placeholder="${escapeHtml(options.placeholder || "")}" ${options.maxlength ? `maxlength="${options.maxlength}"` : ""}></label>`;
  }

  function sectionIntro(title, text) {
    return `<div class="section-intro"><h3>${title}</h3><p>${text}</p></div>`;
  }

  function generalStep() {
    return `${sectionIntro("البيانات العامة", "تُستخدم هذه البيانات في جميع مراحل الزيارة وتظهر في مواضعها داخل الاستمارة المطبوعة.")}
      <div class="fields-grid">
        ${field("اسم المدرسة", "schoolName", { required: true, full: true, placeholder: "اكتب الاسم الرسمي للمدرسة" })}
        ${field("الرقم الوزاري", "ministryNumber", { required: true, inputMode: "numeric" })}
        ${field("البريد الإلكتروني", "email", { inputType: "email", inputMode: "email" })}
        ${field("المرحلة الدراسية", "stage", { type: "select", options: ["طفولة مبكرة", "الابتدائية", "المتوسطة", "الثانوية"] })}
        ${field("الجنس", "gender", { type: "select", options: ["بنين", "بنات"] })}
        ${field("نوع المدرسة", "schoolType", { type: "select", options: ["نهاري", "تحفيظ", "أخرى"] })}
        ${field("حالة الاستقلال", "independence", { type: "select", options: ["مستقل", "مشترك (المبنى)", "مشترك (الإدارة)"] })}
      </div>
      <div class="subsection-title"><h3>بيانات مدير/ة المدرسة</h3></div>
      <div class="fields-grid">
        ${field("الاسم رباعيًا", "directorName", { required: true, full: true })}
        ${field("المسمى الوظيفي في نظام فارس", "jobTitle")}
        ${field("رقم الجوال", "mobile", { inputMode: "tel" })}
        ${field("السجل المدني", "civilId", { inputMode: "numeric" })}
        ${field("سنوات الخبرة كمدير/ة", "directorExperience", { inputMode: "numeric" })}
        ${field("سنوات الخبرة في المدرسة الحالية", "currentSchoolExperience", { inputMode: "numeric" })}
        ${field("الأداء الوظيفي لعام 1446", "performance1446", { inputMode: "numeric" })}
        ${field("الأداء الوظيفي لعام 1447", "performance1447", { inputMode: "numeric" })}
      </div>`;
  }

  function performanceStep() {
    return `${sectionIntro("مؤشرات المدرسة", "أدخل الأعداد ونتائج الأداء المتاحة. يمكن ترك الحقول غير المنطبقة فارغة.")}
      <div class="subsection-title"><h3>الأعداد</h3></div>
      <div class="fields-grid compact">
        ${field("إجمالي الطلاب والطالبات", "studentsTotal", { inputMode: "numeric" })}
        ${field("عدد المتغيبين", "studentsAbsent", { inputMode: "numeric" })}
        ${field("إجمالي الفصول الدراسية", "classesTotal", { inputMode: "numeric" })}
        ${field("إجمالي الهيئة الإشرافية", "supervisorsTotal", { inputMode: "numeric" })}
        ${field("المتغيبون من الهيئة الإشرافية", "supervisorsAbsent", { inputMode: "numeric" })}
        ${field("إجمالي الهيئة الإدارية", "adminsTotal", { inputMode: "numeric" })}
        ${field("المتغيبون من الهيئة الإدارية", "adminsAbsent", { inputMode: "numeric" })}
        ${field("إجمالي الهيئة التعليمية", "teachersTotal", { inputMode: "numeric" })}
        ${field("المتغيبون من الهيئة التعليمية", "teachersAbsent", { inputMode: "numeric" })}
      </div>
      <div class="subsection-title"><h3>التقويم والأداء</h3></div>
      <div class="fields-grid">
        ${field("التقويم المدرسي", "schoolEvaluation", { type: "select", options: ["خارجي", "ذاتي", "لم يصدر لها تقرير"] })}
        ${field("الأداء العام للمدرسة 2025", "schoolPerformance2025", { type: "select", options: ["التميز", "التقدم", "الانطلاق", "التهيئة"] })}
        ${field("أداء مجال الإدارة المدرسية 2025", "managementPerformance2025", { type: "select", options: ["التميز", "التقدم", "الانطلاق", "التهيئة"] })}
        ${field("الأداء العام للمدرسة 2026", "schoolPerformance2026", { type: "select", options: ["التميز", "التقدم", "الانطلاق", "التهيئة"] })}
        ${field("أداء مجال الإدارة المدرسية 2026", "managementPerformance2026", { type: "select", options: ["التميز", "التقدم", "الانطلاق", "التهيئة"] })}
      </div>
      <details class="optional-section"><summary>الاختبارات الوطنية والتحصيلية</summary><div class="fields-grid compact">
        ${field("نافس الصف الثالث الابتدائي", "nafisThird")}${field("نافس الصف السادس الابتدائي", "nafisSixth")}${field("نافس الصف الثالث المتوسط", "nafisMiddle")}
        ${field("التحصيلي علمي المدرسة", "achievementScientificSchool")}${field("التحصيلي علمي الإدارة", "achievementScientificOffice")}
        ${field("التحصيلي نظري المدرسة", "achievementTheoreticalSchool")}${field("التحصيلي نظري الإدارة", "achievementTheoreticalOffice")}
        ${field("القدرات علمي المدرسة", "aptitudeScientificSchool")}${field("القدرات علمي الإدارة", "aptitudeScientificOffice")}
        ${field("القدرات نظري المدرسة", "aptitudeTheoreticalSchool")}${field("القدرات نظري الإدارة", "aptitudeTheoreticalOffice")}
      </div></details>
      <div class="subsection-title"><h3>وكلاء المدرسة</h3></div><div class="fields-grid">
        ${field("وكيل/ة الشؤون التعليمية", "deputyAcademic")}${field("وكيل/ة الشؤون المدرسية", "deputySchool")}${field("وكيل/ة الشؤون الطلابية", "deputyStudents")}
      </div>`;
  }

  function stageTabs() {
    return `<div class="stage-tabs" role="tablist" aria-label="مرحلة الزيارة">${stages.map((stage) => `<button type="button" role="tab" aria-selected="${activeStage === stage.key}" class="${activeStage === stage.key ? "active" : ""}" data-action="change-stage" data-stage="${stage.key}"><span>${stage.label}</span><small>${stageCompletion(currentRecord, stage.key)}%</small></button>`).join("")}</div>`;
  }

  function criteriaStep() {
    const criterion = criteria[currentCriterion];
    const visit = currentRecord.visits[activeStage];
    const selected = Number(visit.ratings?.[criterion.id] || 0);
    return `${sectionIntro("عناصر تقييم الأداء", "اختر المرحلة ثم قيّم كل عنصر. يظهر وصف الدرجة وشواهد التنفيذ عند الحاجة.")}
      ${stageTabs()}
      <div class="criterion-toolbar">
        <label><span>انتقل إلى معيار</span><select id="criterionSelect">${criteria.map((item, index) => `<option value="${index}" ${index === currentCriterion ? "selected" : ""}>${item.id}. ${escapeHtml(item.title)}</option>`).join("")}</select></label>
        <div class="criterion-progress"><span>${currentCriterion + 1} من ${criteria.length}</span><div><i style="width:${((currentCriterion + 1) / criteria.length) * 100}%"></i></div></div>
      </div>
      <article class="criterion-card" id="criterionCard">
        <div class="criterion-heading"><span class="criterion-number">${criterion.id}</span><div><h3>${escapeHtml(criterion.title)}</h3><p>الوزن النسبي ${criterion.weight}%</p></div></div>
        <details class="evidence"><summary>عرض شواهد التنفيذ <span>${criterion.evidence.length}</span></summary><ul>${criterion.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></details>
        <fieldset class="rating-fieldset"><legend>سلم التقدير</legend><div class="rating-options">${[1,2,3,4,5].map((rating) => `<button type="button" class="rating-button ${selected === rating ? "selected" : ""}" data-action="rate" data-rating="${rating}"><strong>${rating}</strong><span>${["غير مرضي", "بحاجة إلى تطوير", "وافق التوقعات", "تخطى التوقعات", "مثالي"][rating - 1]}</span></button>`).join("")}</div></fieldset>
        <div class="rating-description ${selected ? "visible" : ""}" id="ratingDescription">${selected ? `<b>وصف الدرجة ${selected}</b><p>${escapeHtml(criterion.levels[selected - 1] || "")}</p>` : "اختر درجة لعرض وصفها"}</div>
        <div class="criterion-nav"><button class="secondary-button" type="button" data-action="previous-criterion" ${currentCriterion === 0 ? "disabled" : ""}>المعيار السابق</button><button class="primary-button" type="button" data-action="next-criterion">${currentCriterion === criteria.length - 1 ? "الانتقال إلى الأهداف" : "حفظ والتالي"}</button></div>
      </article>`;
  }

  function goalsStep() {
    const visit = currentRecord.visits[activeStage];
    return `${sectionIntro("الأهداف التطويرية والتوقيعات", "تظهر الأسماء والتوقيعات في موضع المرحلة المخصص لها في نهاية الاستمارة.")}
      ${stageTabs()}
      <div class="visit-meta fields-grid">
        <label class="field"><span>يوم الزيارة</span><input data-visit-field="visitDay" value="${escapeHtml(visit.visitDay)}" placeholder="مثال: الأحد"></label>
        <label class="field"><span>تاريخ الزيارة</span><input data-visit-field="visitDate" value="${escapeHtml(visit.visitDate)}" placeholder="1448/03/10"></label>
      </div>
      <div class="subsection-title"><h3>الأهداف التطويرية</h3><span>حتى 10 أهداف</span></div>
      <div class="goals-list">${visit.goals.map((goal, index) => `<label><span>${index + 1}</span><input data-goal-index="${index}" value="${escapeHtml(goal)}" placeholder="${index === 0 ? "اكتب الهدف التطويري" : "هدف إضافي"}"></label>`).join("")}</div>
      <div class="signatures-grid">
        ${signatureBlock("principal", "مدير/ة المدرسة", visit.principalName || currentRecord.directorName, visit.principalSignature)}
        ${signatureBlock("supervisor", "مشرف/ـة الإدارة المدرسية", visit.supervisorName, visit.supervisorSignature)}
      </div>`;
  }

  function signatureBlock(kind, label, name, signature) {
    return `<section class="signature-card"><h3>${label}</h3><label class="field"><span>الاسم</span><input data-signature-name="${kind}" value="${escapeHtml(name)}"></label><div class="signature-label"><span>التوقيع</span><button type="button" data-action="clear-signature" data-kind="${kind}">مسح التوقيع</button></div><div class="canvas-wrap"><canvas class="signature-canvas" data-kind="${kind}" width="640" height="200" aria-label="توقيع ${label}"></canvas><span class="signature-hint">وقّع بإصبعك هنا</span></div>${signature ? '<span class="signature-saved">التوقيع محفوظ</span>' : ""}</section>`;
  }

  function reviewStep() {
    const missingGeneral = ["schoolName", "ministryNumber", "directorName"].filter((key) => !currentRecord[key]);
    return `${sectionIntro("المراجعة والطباعة", "راجع اكتمال المراحل ثم افتح المعاينة الرسمية قبل الطباعة أو الحفظ PDF.")}
      ${missingGeneral.length ? `<div class="notice warning">أكمل البيانات الأساسية: ${missingGeneral.map((key) => ({schoolName:"اسم المدرسة",ministryNumber:"الرقم الوزاري",directorName:"اسم المدير/ة"})[key]).join("، ")}</div>` : '<div class="notice success">البيانات الأساسية مكتملة.</div>'}
      <div class="review-school"><img src="assets/ministry-logo.jpeg" alt=""><div><span>اسم المدرسة</span><h3>${escapeHtml(currentRecord.schoolName || "لم يُدخل بعد")}</h3><p>${escapeHtml(currentRecord.ministryNumber || "الرقم الوزاري غير مدخل")}</p></div><strong>${totalCompletion(currentRecord)}%</strong></div>
      <div class="review-stages">${stages.map((stage) => { const score = scoreFor(currentRecord, stage.key); const rated = Object.keys(currentRecord.visits[stage.key].ratings || {}).length; const completion = stageCompletion(currentRecord, stage.key); return `<article><div><h3>${stage.label}</h3><span>${rated} من ${criteria.length} معيارًا</span></div><div class="score-ring"><strong>${score.toFixed(0)}</strong><span>${scoreLabel(score)}</span></div><div class="progress-track" role="progressbar" aria-label="اكتمال ${stage.label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${completion}"><span style="width:${completion}%"></span></div><button class="secondary-button" type="button" data-action="review-stage" data-stage="${stage.key}">مراجعة المرحلة</button></article>`; }).join("")}</div>
      <div class="print-card"><div><h3>نسخة الطباعة الرسمية</h3><p>16 صفحة A4 أفقية بعد إصلاح كسر جدول الملخص، مع الشعارات والجداول الأصلية.</p></div><button class="primary-button" type="button" data-action="print-current">معاينة وطباعة</button></div>
      <div class="local-note"><b>خصوصية السجلات</b><p>البيانات والتوقيعات محفوظة على هذا الجهاز ولا تُرسل إلى خادم. استخدم النسخة الاحتياطية من القائمة العلوية لحمايتها من فقد بيانات المتصفح.</p></div>`;
  }

  function initSignaturePads() {
    document.querySelectorAll(".signature-canvas").forEach((canvas) => {
      const kind = canvas.dataset.kind;
      const context = canvas.getContext("2d");
      context.lineWidth = 3;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = "#183235";
      const saved = currentRecord.visits[activeStage][`${kind}Signature`];
      if (saved) {
        const image = new Image();
        image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height);
        image.src = saved;
      }
      let drawing = false;
      const point = (event) => {
        const rect = canvas.getBoundingClientRect();
        return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
      };
      canvas.addEventListener("pointerdown", (event) => {
        drawing = true;
        canvas.setPointerCapture(event.pointerId);
        const p = point(event);
        context.beginPath();
        context.moveTo(p.x, p.y);
      });
      canvas.addEventListener("pointermove", (event) => {
        if (!drawing) return;
        const p = point(event);
        context.lineTo(p.x, p.y);
        context.stroke();
      });
      const finish = () => {
        if (!drawing) return;
        drawing = false;
        currentRecord.visits[activeStage][`${kind}Signature`] = canvas.toDataURL("image/png");
        saveCurrent();
        canvas.closest(".signature-card")?.querySelector(".signature-hint")?.classList.add("hidden");
      };
      canvas.addEventListener("pointerup", finish);
      canvas.addEventListener("pointercancel", finish);
    });
  }

  function handleInput(event) {
    if (!currentRecord) return;
    const target = event.target;
    if (target.dataset.field) currentRecord[target.dataset.field] = target.value;
    if (target.dataset.visitField) currentRecord.visits[activeStage][target.dataset.visitField] = target.value;
    if (target.dataset.goalIndex !== undefined) currentRecord.visits[activeStage].goals[Number(target.dataset.goalIndex)] = target.value;
    if (target.dataset.signatureName) {
      const fieldName = `${target.dataset.signatureName}Name`;
      currentRecord.visits[activeStage][fieldName] = target.value;
      if (target.dataset.signatureName === "principal" && !target.value) currentRecord.visits[activeStage].principalName = currentRecord.directorName;
    }
    saveCurrent();
  }

  function handleRating(button) {
    const rating = Number(button.dataset.rating);
    const criterion = criteria[currentCriterion];
    currentRecord.visits[activeStage].ratings[criterion.id] = rating;
    saveCurrent();
    document.querySelectorAll(".rating-button").forEach((item) => item.classList.toggle("selected", item === button));
    const description = document.getElementById("ratingDescription");
    description.classList.add("visible");
    description.innerHTML = `<b>وصف الدرجة ${rating}</b><p>${escapeHtml(criterion.levels[rating - 1] || "")}</p>`;
    const tab = document.querySelector(`.stage-tabs button[data-stage="${activeStage}"] small`);
    if (tab) tab.textContent = `${stageCompletion(currentRecord, activeStage)}%`;
  }

  function showBackupDialog() {
    document.getElementById("backupDialog")?.remove();
    const dialog = document.createElement("dialog");
    dialog.id = "backupDialog";
    dialog.className = "backup-dialog";
    dialog.innerHTML = `<form method="dialog"><div class="dialog-heading"><div><span class="eyebrow">حماية السجلات المحلية</span><h2>النسخ الاحتياطي</h2></div><button class="icon-button" value="cancel" aria-label="إغلاق">×</button></div><p>صدّر جميع السجلات إلى ملف محفوظ، أو استورد نسخة سابقة إلى هذا الجهاز.</p><button class="primary-button wide" type="button" data-action="export-backup">تنزيل نسخة احتياطية</button><label class="secondary-button import-label">استيراد نسخة احتياطية<input id="backupFile" type="file" accept="application/json,.json"></label></form>`;
    document.body.append(dialog);
    dialog.showModal();
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), records }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `نسخة-احتياطية-للزيارات-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function importBackup(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = Array.isArray(parsed) ? parsed : parsed.records;
      if (!Array.isArray(incoming)) throw new Error("invalid");
      const byId = new Map(records.map((record) => [record.id, record]));
      incoming.map(normalizeRecord).forEach((record) => byId.set(record.id, record));
      records = [...byId.values()].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      saveRecords();
      document.getElementById("backupDialog")?.close();
      renderDashboard();
      alert("تم استيراد النسخة الاحتياطية بنجاح.");
    } catch (_) {
      alert("تعذر قراءة الملف. اختر نسخة احتياطية صادرة من هذا التطبيق.");
    }
  }

  function customSummary(record) {
    const summaryStage = latestStage(record);
    return `<section class="print-page summary-print-page">
      <div class="print-letterhead"><img src="assets/ministry-logo.jpeg" alt="وزارة التعليم"><div>استمارة الزيارة الفنية لمدير/ة المدرسة<br><b>1448 هـ - 2027 م</b></div></div>
      <h2>نموذج تقييم أداء مدير/ة المدرسة</h2>
      <div class="summary-layout"><table class="official-summary"><thead><tr><th>رقم</th><th>عناصر التقييم</th><th>الوزن النسبي</th><th colspan="5">سلم التقدير</th></tr><tr><th></th><th></th><th></th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr></thead><tbody>${criteria.map((criterion) => { const selected = Number(record.visits[summaryStage].ratings?.[criterion.id] || 0); return `<tr><td>${criterion.id}</td><td>${escapeHtml(criterion.title)}</td><td>${criterion.weight}%</td>${[1,2,3,4,5].map((rating) => `<td>${selected === rating ? "✓" : ""}</td>`).join("")}</tr>`; }).join("")}<tr class="total-row"><td colspan="2">التقدير العام للأداء</td><td>${scoreFor(record, summaryStage).toFixed(0)}%</td><td colspan="5">${scoreLabel(scoreFor(record, summaryStage))}</td></tr></tbody></table>
      <table class="scale-table"><thead><tr><th colspan="3">مستويات قياس الأداء</th></tr><tr><th>وصف التقدير</th><th>التصنيف</th><th>الدرجة النسبية</th></tr></thead><tbody><tr><td>مثالي</td><td>5</td><td>90-100</td></tr><tr><td>تخطى التوقعات</td><td>4</td><td>80-89</td></tr><tr><td>وافق التوقعات</td><td>3</td><td>70-79</td></tr><tr><td>بحاجة إلى تطوير</td><td>2</td><td>60-69</td></tr><tr><td>غير مرضي</td><td>1</td><td>أقل من 60</td></tr></tbody></table></div>
      <img class="print-footer-bar" src="assets/footer-bar.png" alt=""><span class="custom-page-number">2</span>
    </section>`;
  }

  function overlay(text, left, top, width, className = "") {
    if (!text) return "";
    return `<span class="print-overlay ${className}" style="left:${left}%;top:${top}%;width:${width}%">${escapeHtml(text)}</span>`;
  }

  function check(left, top) {
    return `<span class="print-check" style="left:${left}%;top:${top}%">✓</span>`;
  }

  function generalOverlays(record) {
    let html = "";
    html += overlay(record.schoolName, 4, 19.2, 65.5);
    html += overlay(record.ministryNumber, 4, 22.1, 65.5);
    html += overlay(record.email, 4, 24.8, 65.5);
    const stageX = { "طفولة مبكرة": 64.5, "الابتدائية": 52, "المتوسطة": 35.5, "الثانوية": 13.5 };
    const genderX = { "بنين": 64.8, "بنات": 35.5 };
    const typeX = { "نهاري": 64.5, "تحفيظ": 35.5, "أخرى": 13.5 };
    const independenceX = { "مستقل": 64.5, "مشترك (المبنى)": 35.5, "مشترك (الإدارة)": 35.5 };
    if (stageX[record.stage]) html += check(stageX[record.stage], 28.15);
    if (genderX[record.gender]) html += check(genderX[record.gender], 31.15);
    if (typeX[record.schoolType]) html += check(typeX[record.schoolType], 34.0);
    if (independenceX[record.independence]) html += check(independenceX[record.independence], 36.8);
    html += overlay(record.directorName, 57.3, 42.2, 12);
    html += overlay(record.jobTitle, 38.8, 42.2, 6.5);
    html += overlay(record.mobile, 28, 40.7, 6.5);
    html += overlay(record.civilId, 28, 44.4, 6.5);
    html += overlay(record.directorExperience, 16, 42.2, 5.2);
    html += overlay(record.currentSchoolExperience, 3.8, 42.2, 5.2);
    html += overlay(record.performance1446, 57.3, 47.5, 12);
    html += overlay(record.performance1447, 21.2, 47.5, 24);
    const visitX = { planning: 57.4, midyear: 35.4, evaluation: 12.3 };
    stages.forEach((stage) => {
      const visit = record.visits[stage.key];
      html += overlay(visit.visitDay, visitX[stage.key], 50.6, 11.5);
      html += overlay(visit.visitDate, visitX[stage.key], 54.0, 11.5);
      if (visit.visitDate || Object.keys(visit.ratings || {}).length) html += check(visitX[stage.key] + 7.8, 57.1);
    });
    html += overlay(record.studentsTotal, 57.6, 64.4, 4.5);
    html += overlay(record.studentsAbsent, 49.2, 64.4, 3.5);
    html += overlay(record.classesTotal, 37.7, 64.4, 5);
    html += overlay(record.supervisorsTotal, 57.6, 74.3, 4.5);
    html += overlay(record.supervisorsAbsent, 49.2, 74.3, 3.5);
    html += overlay(record.adminsTotal, 37.7, 74.3, 4.5);
    html += overlay(record.adminsAbsent, 28.7, 74.3, 3.5);
    html += overlay(record.teachersTotal, 17.2, 74.3, 4.5);
    html += overlay(record.teachersAbsent, 7.3, 74.3, 3.5);
    const evalX = { "خارجي": 64.5, "ذاتي": 35.5, "لم يصدر لها تقرير": 13.5 };
    if (evalX[record.schoolEvaluation]) html += check(evalX[record.schoolEvaluation], 81.0);
    return html;
  }

  function performanceOverlays(record) {
    let html = "";
    const ratingX = { "التميز": 63.2, "التقدم": 52.3, "الانطلاق": 42.6, "التهيئة": 36.6 };
    [["schoolPerformance2025", 13.8], ["managementPerformance2025", 16.8], ["schoolPerformance2026", 25.3], ["managementPerformance2026", 28.3]].forEach(([key, top]) => { if (ratingX[record[key]]) html += check(ratingX[record[key]], top); });
    html += overlay(record.nafisThird, 57.5, 43.5, 12);
    html += overlay(record.nafisSixth, 57.5, 51.4, 12);
    html += overlay(record.nafisMiddle, 57.5, 60.8, 12);
    html += overlay(record.achievementScientificSchool, 28.5, 67.0, 10);
    html += overlay(record.achievementScientificOffice, 8.0, 67.0, 10);
    html += overlay(record.achievementTheoreticalSchool, 28.5, 70.8, 10);
    html += overlay(record.achievementTheoreticalOffice, 8.0, 70.8, 10);
    html += overlay(record.aptitudeScientificSchool, 28.5, 74.8, 10);
    html += overlay(record.aptitudeScientificOffice, 8.0, 74.8, 10);
    html += overlay(record.aptitudeTheoreticalSchool, 28.5, 78.6, 10);
    html += overlay(record.aptitudeTheoreticalOffice, 8.0, 78.6, 10);
    html += overlay(record.deputyAcademic, 57.5, 85.9, 11);
    html += overlay(record.deputySchool, 37.5, 85.9, 11);
    html += overlay(record.deputyStudents, 17.5, 85.9, 11);
    return html;
  }

  function criteriaMarkers(record, pageNumber) {
    const firstId = (pageNumber - 6) * 2 + 1;
    const ids = pageNumber === 15 ? [19] : [firstId, firstId + 1];
    const x = { planning: 20.75, midyear: 13.55, evaluation: 6.45 };
    const topRows = [33.15, 35.7, 38.1, 42.0, 48.05];
    const bottomRows = [65.15, 67.65, 70.1, 74.15, 80.5];
    let html = "";
    ids.forEach((id, index) => {
      stages.forEach((stage) => {
        const rating = Number(record.visits[stage.key].ratings?.[id] || 0);
        if (rating) html += check(x[stage.key], (index === 0 ? topRows : bottomRows)[rating - 1]);
      });
    });
    return html;
  }

  function goalsOverlay(record, stageKey, startTop, rowStep, nameTop, signatureTop) {
    const visit = record.visits[stageKey];
    let html = visit.goals.map((goal, index) => overlay(goal, 7, startTop + rowStep * index, 76.5, "goal-overlay")).join("");
    html += overlay(visit.principalName || record.directorName, 70, nameTop, 15, "name-overlay adjacent-value");
    html += overlay(visit.supervisorName, 4, nameTop, 15, "name-overlay adjacent-value");
    if (visit.principalSignature) html += `<img class="print-signature" src="${visit.principalSignature}" style="left:70%;top:${signatureTop}%;width:15%;height:4.2%" alt="توقيع مدير المدرسة">`;
    if (visit.supervisorSignature) html += `<img class="print-signature" src="${visit.supervisorSignature}" style="left:4%;top:${signatureTop}%;width:15%;height:4.2%" alt="توقيع المشرف">`;
    return html;
  }

  function backgroundPage(sourcePage, outputPage, overlays = "") {
    const source = String(sourcePage).padStart(2, "0");
    return `<section class="print-page background-print-page"><img class="page-background" src="assets/print-pages/page-${source}.png" alt="">${overlays}<span class="corrected-page-number">${outputPage}</span></section>`;
  }

  function buildPrint(record) {
    document.getElementById("printRoot")?.remove();
    const root = document.createElement("div");
    root.id = "printRoot";
    root.className = "print-root";
    const pages = [];
    pages.push(backgroundPage(1, 1));
    pages.push(customSummary(record));
    pages.push(backgroundPage(4, 3, generalOverlays(record)));
    pages.push(backgroundPage(5, 4, performanceOverlays(record)));
    for (let source = 6; source <= 15; source += 1) pages.push(backgroundPage(source, source - 1, criteriaMarkers(record, source)));
    pages.push(backgroundPage(16, 15, goalsOverlay(record, "planning", 22.1, 2.66, 48.9, 51.0) + goalsOverlay(record, "midyear", 58.5, 2.91, 88.2, 91.1)));
    pages.push(backgroundPage(17, 16, goalsOverlay(record, "evaluation", 18.1, 2.66, 44.8, 49.0)));
    root.innerHTML = pages.join("");
    document.body.append(root);
    return root;
  }

  function showToast(message) {
    document.querySelector(".app-toast")?.remove();
    const toast = document.createElement("div");
    toast.className = "app-toast";
    toast.textContent = message;
    document.body.append(toast);
    requestAnimationFrame(() => toast.classList.add("visible"));
    setTimeout(() => { toast.classList.remove("visible"); setTimeout(() => toast.remove(), 250); }, 2200);
  }

  async function executePrint(record) {
    if (!record) return;
    showToast("جاري تجهيز 16 صفحة للطباعة…");
    const root = document.getElementById("printRoot") || buildPrint(record);
    const images = [...root.querySelectorAll("img")];
    await Promise.all(images.map((image) => image.complete ? image.decode?.().catch(() => {}) : new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    })));
    const oldTitle = document.title;
    document.title = `${record.schoolName || "استمارة"} - الزيارة الفنية`;
    document.body.classList.add("printing");
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    setTimeout(() => {
      document.body.classList.remove("printing");
      document.title = oldTitle;
    }, 1500);
  }

  function showPrintPreview(record) {
    if (!record) return;
    currentPrintRecord = record;
    buildPrint(record);
    document.querySelector(".print-preview-bar")?.remove();
    const bar = document.createElement("div");
    bar.className = "print-preview-bar";
    bar.innerHTML = `<div><b>${escapeHtml(record.schoolName || "استمارة الزيارة الفنية")}</b><span>معاينة 16 صفحة A4 أفقية</span></div><div><button type="button" class="secondary-button" data-action="close-preview">إغلاق</button><button type="button" class="primary-button" data-action="execute-print">طباعة أو حفظ PDF</button></div>`;
    document.body.append(bar);
    document.body.classList.add("previewing");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function closePrintPreview() {
    document.body.classList.remove("previewing", "printing");
    document.querySelector(".print-preview-bar")?.remove();
    document.getElementById("printRoot")?.remove();
    currentPrintRecord = null;
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function registerWebMcpTools() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    Promise.resolve(context.registerTool({
      name: "list_local_school_visit_records",
      title: "عرض سجلات الزيارات",
      description: "يعرض السجلات المحفوظة محليًا على هذا الجهاز دون تعديلها.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute() {
        return { records: records.map((record) => ({ id: record.id, schoolName: record.schoolName, ministryNumber: record.ministryNumber, completion: totalCompletion(record), updatedAt: record.updatedAt })) };
      }
    }, { signal: lifecycle.signal })).catch(() => {});
    Promise.resolve(context.registerTool({
      name: "start_new_school_visit_form",
      title: "بدء استمارة زيارة",
      description: "ينشئ سجل زيارة محليًا ويفتح شاشة إدخال بيانات المدرسة.",
      inputSchema: {
        type: "object",
        properties: { schoolName: { type: "string" }, ministryNumber: { type: "string" } },
        additionalProperties: false
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (input == null || typeof input !== "object" || Array.isArray(input)) throw new TypeError("يجب أن تكون المدخلات كائنًا صالحًا.");
        const unknown = Object.keys(input).filter((key) => !["schoolName", "ministryNumber"].includes(key));
        if (unknown.length || (input.schoolName !== undefined && typeof input.schoolName !== "string") || (input.ministryNumber !== undefined && typeof input.ministryNumber !== "string")) {
          throw new TypeError("اسم المدرسة والرقم الوزاري يجب أن يكونا نصًا، ولا تُقبل حقول إضافية.");
        }
        const record = newRecord();
        record.schoolName = String(input?.schoolName || "").trim();
        record.ministryNumber = String(input?.ministryNumber || "").trim();
        records.unshift(record);
        saveRecords();
        openRecord(record);
        return { id: record.id, status: "draft", schoolName: record.schoolName };
      }
    }, { signal: lifecycle.signal })).catch(() => {});
  }

  document.addEventListener("input", handleInput);
  document.addEventListener("change", (event) => {
    handleInput(event);
    if (event.target.id === "criterionSelect") {
      currentCriterion = Number(event.target.value);
      renderEditor();
    }
    if (event.target.id === "backupFile") importBackup(event.target.files?.[0]);
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "new-record") {
      const record = newRecord();
      records.unshift(record);
      saveRecords();
      openRecord(record);
    }
    if (action === "edit-record") openRecord(records.find((record) => record.id === button.dataset.id));
    if (action === "print-record") showPrintPreview(records.find((record) => record.id === button.dataset.id));
    if (action === "delete-record") {
      const record = records.find((item) => item.id === button.dataset.id);
      if (record && confirm(`حذف سجل ${record.schoolName || "الاستمارة"} من هذا الجهاز؟`)) {
        records = records.filter((item) => item.id !== button.dataset.id);
        saveRecords();
        renderDashboard();
      }
    }
    if (action === "dashboard") { saveCurrent(); renderDashboard(); }
    if (action === "step") { currentStep = Number(button.dataset.step); saveCurrent(); renderEditor(); }
    if (action === "next-step") { currentStep = Math.min(steps.length - 1, currentStep + 1); saveCurrent(); renderEditor(); }
    if (action === "previous-step") { currentStep = Math.max(0, currentStep - 1); saveCurrent(); renderEditor(); }
    if (action === "change-stage") { activeStage = button.dataset.stage; renderEditor(); }
    if (action === "rate") handleRating(button);
    if (action === "previous-criterion") { currentCriterion = Math.max(0, currentCriterion - 1); renderEditor(); }
    if (action === "next-criterion") {
      if (currentCriterion < criteria.length - 1) currentCriterion += 1;
      else currentStep = 3;
      renderEditor();
    }
    if (action === "review-stage") { activeStage = button.dataset.stage; currentStep = 2; currentCriterion = 0; renderEditor(); }
    if (action === "clear-signature") {
      const kind = button.dataset.kind;
      currentRecord.visits[activeStage][`${kind}Signature`] = "";
      saveCurrent();
      renderEditor();
    }
    if (action === "print-current") { saveCurrent(); showPrintPreview(currentRecord); }
    if (action === "execute-print") executePrint(currentPrintRecord);
    if (action === "close-preview") closePrintPreview();
    if (action === "export-backup") exportBackup();
  });

  document.getElementById("newRecordButton")?.addEventListener("click", () => {
    const record = newRecord();
    records.unshift(record);
    saveRecords();
    openRecord(record);
  });
  document.getElementById("backupButton")?.addEventListener("click", showBackupDialog);
  window.addEventListener("afterprint", () => {
    document.body.classList.remove("printing");
    if (!document.body.classList.contains("previewing")) document.getElementById("printRoot")?.remove();
  });
  window.addEventListener("beforeunload", saveCurrent);

  renderDashboard();
  registerWebMcpTools();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js").catch(() => {});
})();
