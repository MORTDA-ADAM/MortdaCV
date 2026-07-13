const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { UPLOADS_DIR } = require("./paths");

const COLOR = {
  text: "#1a1a1a",
  muted: "#5a5a5a",
  accent: "#1f5f4f",
  border: "#dcdcdc",
};

function resolvePhotoPath(photo) {
  if (!photo) return null;
  const filename = photo.split("?")[0].replace(/^\/uploads\//, "");
  const full = path.join(UPLOADS_DIR, filename);
  return fs.existsSync(full) ? full : null;
}

function sectionHeading(doc, title) {
  doc.moveDown(0.9);
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(COLOR.accent).text(title.toUpperCase(), { characterSpacing: 1.1 });
  const y = doc.y + 2;
  doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).lineWidth(1).strokeColor(COLOR.border).stroke();
  doc.moveDown(0.6);
}

function buildCvPdf(content) {
  const doc = new PDFDocument({ size: "A4", margins: { top: 50, bottom: 50, left: 56, right: 56 } });
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // ---------- Header ----------
  const photoPath = resolvePhotoPath(content.profile.photo);
  const headerTop = doc.y;
  const textLeft = photoPath ? doc.page.margins.left + 70 : doc.page.margins.left;

  if (photoPath) {
    const size = 60;
    const cx = doc.page.margins.left + size / 2;
    const cy = headerTop + size / 2;
    doc.save();
    doc.circle(cx, cy, size / 2).clip();
    doc.image(photoPath, doc.page.margins.left, headerTop, { width: size, height: size });
    doc.restore();
  }

  doc.font("Helvetica-Bold").fontSize(20).fillColor(COLOR.text).text(content.profile.name || "", textLeft, headerTop, { width: contentWidth - (textLeft - doc.page.margins.left) });
  doc.font("Helvetica").fontSize(11.5).fillColor(COLOR.accent).text(content.profile.title || "", textLeft);

  const contactParts = [content.profile.email, content.profile.phone, content.profile.location].filter(Boolean);
  doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted).text(contactParts.join("   ·   "), textLeft);
  if (content.profile.linkedin) {
    doc.font("Helvetica").fontSize(9).fillColor(COLOR.accent).text(content.profile.linkedin, textLeft, doc.y, { link: content.profile.linkedin, underline: true });
  }

  doc.y = Math.max(doc.y, headerTop + 70) + 4;
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).lineWidth(1.2).strokeColor(COLOR.accent).stroke();

  // ---------- About ----------
  if (content.profile.bio) {
    sectionHeading(doc, "About");
    doc.font("Helvetica").fontSize(9.5).fillColor(COLOR.text).text(content.profile.bio, { lineGap: 2 });
  }

  // ---------- Experience ----------
  if (content.experience?.length) {
    sectionHeading(doc, "Work Experience");
    content.experience.forEach((job, i) => {
      if (i > 0) doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(COLOR.text).text(job.role, { continued: Boolean(job.period) });
      if (job.period) {
        doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.muted).text(`   ${job.period}`, { align: "left" });
      }
      doc.font("Helvetica").fontSize(9).fillColor(COLOR.accent).text(job.org);
      (job.bullets || []).forEach((b) => {
        doc.font("Helvetica").fontSize(9).fillColor(COLOR.text).text(`•  ${b}`, { lineGap: 1 });
      });
      if (job.modules?.length) {
        doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(COLOR.muted).text(job.modules.join("   ·   "));
      }
    });
  }

  // ---------- Education ----------
  if (content.education?.length) {
    sectionHeading(doc, "Education");
    content.education.forEach((e, i) => {
      if (i > 0) doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(COLOR.text).text(e.degree, { continued: Boolean(e.period) });
      if (e.period) doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.muted).text(`   ${e.period}`);
      doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted).text(e.org);
    });
  }

  // ---------- Publications ----------
  if (content.publications?.length) {
    sectionHeading(doc, "Publications & Research");
    content.publications.forEach((p, i) => {
      if (i > 0) doc.moveDown(0.35);
      const title = p.badge ? `${p.title}  [${p.badge}]` : p.title;
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(COLOR.text).text(title, { lineGap: 1 });
      const metaLine = p.meta || "";
      doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.muted).text(metaLine);
      if (p.doiUrl) {
        doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.accent).text(p.doiLabel || p.doiUrl, { link: p.doiUrl, underline: true });
      }
    });
  }

  // ---------- Projects ----------
  if (content.projects?.length) {
    sectionHeading(doc, "Projects");
    content.projects.forEach((p) => {
      doc.font("Helvetica").fontSize(9).fillColor(COLOR.text).text(`•  ${p.title}`, { lineGap: 1 });
    });
  }

  // ---------- Skills ----------
  if (content.skills?.technical?.length || content.skills?.soft?.length) {
    sectionHeading(doc, "Skills");
    if (content.skills.technical?.length) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR.text).text("Technical: ", { continued: true });
      doc.font("Helvetica").fontSize(9).fillColor(COLOR.text).text(content.skills.technical.join(", "));
    }
    if (content.skills.soft?.length) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLOR.text).text("Soft skills: ", { continued: true });
      doc.font("Helvetica").fontSize(9).fillColor(COLOR.text).text(content.skills.soft.join(", "));
    }
  }

  // ---------- Conferences ----------
  if (content.conferences?.length) {
    sectionHeading(doc, "Conferences & Participation");
    content.conferences.forEach((c) => {
      doc.font("Helvetica").fontSize(9).fillColor(COLOR.text).text(`•  ${c.name}`, { continued: true });
      doc.font("Helvetica").fontSize(9).fillColor(COLOR.muted).text(`   ${c.year}`);
    });
  }

  // ---------- Professional Body ----------
  if (content.professionalBody?.length) {
    sectionHeading(doc, "Professional Body");
    content.professionalBody.forEach((b) => {
      doc.font("Helvetica").fontSize(9).fillColor(COLOR.text).text(`${b.name} — ${b.role}`);
    });
  }

  // ---------- Certifications ----------
  if (content.certifications?.length) {
    sectionHeading(doc, "Certifications");
    content.certifications.forEach((c) => {
      doc.font("Helvetica").fontSize(9).fillColor(COLOR.text).text(`•  ${c.name}`, { lineGap: 1 });
    });
  }

  return doc;
}

module.exports = { buildCvPdf };
