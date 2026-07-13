(function () {
  "use strict";

  const initial = JSON.parse(document.getElementById("initial-content").textContent);

  const LIST_CONFIG = {
    education: {
      containerId: "education-list",
      fields: [
        { key: "degree", label: "Degree", type: "text" },
        { key: "org", label: "Organization", type: "text" },
        { key: "period", label: "Period", type: "text" },
      ],
    },
    experience: {
      containerId: "experience-list",
      fields: [
        { key: "role", label: "Role", type: "text" },
        { key: "org", label: "Organization", type: "text" },
        { key: "period", label: "Period (e.g. Current, or blank)", type: "text" },
        { key: "bullets", label: "Responsibilities (one per line)", type: "lines" },
        { key: "modules", label: "Modules / topics (one per line)", type: "lines" },
      ],
    },
    publications: {
      containerId: "publications-list",
      fields: [
        { key: "title", label: "Title", type: "text" },
        { key: "meta", label: "Journal / meta info", type: "text" },
        { key: "badge", label: "Badge (e.g. \"Under Review\")", type: "text" },
        { key: "doiUrl", label: "DOI / link URL", type: "text" },
        { key: "doiLabel", label: "DOI / link label", type: "text" },
      ],
    },
    projects: {
      containerId: "projects-list",
      fields: [{ key: "title", label: "Title", type: "text" }],
    },
    conferences: {
      containerId: "conferences-list",
      fields: [
        { key: "name", label: "Name", type: "text" },
        { key: "year", label: "Year", type: "text" },
      ],
    },
    professionalBody: {
      containerId: "professionalBody-list",
      fields: [
        { key: "name", label: "Organization", type: "text" },
        { key: "role", label: "Role", type: "text" },
      ],
    },
  };

  function emptyRow(listKey) {
    const row = {};
    LIST_CONFIG[listKey].fields.forEach((f) => {
      row[f.key] = f.type === "lines" || f.type === "tags" ? [] : "";
    });
    return row;
  }

  function buildField(field, value) {
    const wrap = document.createElement("div");
    wrap.className = "field";

    const label = document.createElement("label");
    label.textContent = field.label;
    wrap.appendChild(label);

    let input;
    if (field.type === "lines") {
      input = document.createElement("textarea");
      input.rows = 3;
      input.value = Array.isArray(value) ? value.join("\n") : "";
    } else if (field.type === "tags") {
      input = document.createElement("input");
      input.type = "text";
      input.value = Array.isArray(value) ? value.join(", ") : "";
    } else {
      input = document.createElement("input");
      input.type = "text";
      input.value = value || "";
    }
    input.dataset.field = field.key;
    input.dataset.type = field.type;
    wrap.appendChild(input);

    return wrap;
  }

  function buildRow(listKey, data) {
    const config = LIST_CONFIG[listKey];
    const row = document.createElement("div");
    row.className = "repeat-row";
    row.dataset.list = listKey;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-row";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => row.remove());
    row.appendChild(removeBtn);

    config.fields.forEach((field) => {
      row.appendChild(buildField(field, data[field.key]));
    });

    return row;
  }

  function renderList(listKey, items) {
    const container = document.getElementById(LIST_CONFIG[listKey].containerId);
    container.innerHTML = "";
    items.forEach((item) => container.appendChild(buildRow(listKey, item)));
  }

  function readList(listKey) {
    const container = document.getElementById(LIST_CONFIG[listKey].containerId);
    const config = LIST_CONFIG[listKey];
    return Array.from(container.querySelectorAll(".repeat-row")).map((row) => {
      const item = {};
      config.fields.forEach((field) => {
        const input = row.querySelector(`[data-field="${field.key}"]`);
        if (field.type === "lines") {
          item[field.key] = input.value.split("\n").map((s) => s.trim()).filter(Boolean);
        } else if (field.type === "tags") {
          item[field.key] = input.value.split(",").map((s) => s.trim()).filter(Boolean);
        } else {
          item[field.key] = input.value.trim();
        }
      });
      return item;
    });
  }

  function init() {
    document.getElementById("p-name").value = initial.profile.name || "";
    document.getElementById("p-title").value = initial.profile.title || "";
    document.getElementById("p-bio").value = initial.profile.bio || "";
    document.getElementById("p-email").value = initial.profile.email || "";
    document.getElementById("p-phone").value = initial.profile.phone || "";
    document.getElementById("p-linkedin").value = initial.profile.linkedin || "";
    document.getElementById("p-location").value = initial.profile.location || "";

    document.getElementById("skills-technical").value = (initial.skills.technical || []).join(", ");
    document.getElementById("skills-soft").value = (initial.skills.soft || []).join(", ");

    Object.keys(LIST_CONFIG).forEach((listKey) => {
      renderList(listKey, initial[listKey] || []);
    });

    document.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const listKey = btn.dataset.add;
        const container = document.getElementById(LIST_CONFIG[listKey].containerId);
        container.appendChild(buildRow(listKey, emptyRow(listKey)));
      });
    });

    document.getElementById("cv-form").addEventListener("submit", onSave);
    document.getElementById("photo-upload-btn").addEventListener("click", onPhotoUpload);
  }

  function showBanner(message, isError) {
    const banner = document.getElementById("banner");
    banner.innerHTML = "";
    const div = document.createElement("div");
    div.className = isError ? "form-error" : "form-success";
    div.textContent = message;
    banner.appendChild(div);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSave(e) {
    e.preventDefault();

    const payload = {
      profile: {
        name: document.getElementById("p-name").value.trim(),
        title: document.getElementById("p-title").value.trim(),
        bio: document.getElementById("p-bio").value.trim(),
        email: document.getElementById("p-email").value.trim(),
        phone: document.getElementById("p-phone").value.trim(),
        linkedin: document.getElementById("p-linkedin").value.trim(),
        location: document.getElementById("p-location").value.trim(),
      },
      skills: {
        technical: document.getElementById("skills-technical").value.split(",").map((s) => s.trim()).filter(Boolean),
        soft: document.getElementById("skills-soft").value.split(",").map((s) => s.trim()).filter(Boolean),
      },
    };

    Object.keys(LIST_CONFIG).forEach((listKey) => {
      payload[listKey] = readList(listKey);
    });

    try {
      const res = await fetch("/admin/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": document.body.dataset.csrf },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showBanner(data.error || "Failed to save changes.", true);
        return;
      }
      showBanner("Changes saved.", false);
    } catch {
      showBanner("Network error while saving. Please try again.", true);
    }
  }

  async function onPhotoUpload() {
    const fileInput = document.getElementById("photo-file");
    if (!fileInput.files.length) {
      showBanner("Choose a photo file first.", true);
      return;
    }

    const formData = new FormData();
    formData.append("photo", fileInput.files[0]);
    formData.append("_csrf", document.body.dataset.csrf);

    try {
      const res = await fetch("/admin/api/photo", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        showBanner(data.error || "Failed to upload photo.", true);
        return;
      }
      document.getElementById("photo-preview").src = data.photo;
      showBanner("Photo updated.", false);
    } catch {
      showBanner("Network error while uploading. Please try again.", true);
    }
  }

  init();
})();
