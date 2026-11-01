
document.addEventListener("DOMContentLoaded", () => {
  const stored = localStorage.getItem("joburg_current_user");
  const user = stored ? JSON.parse(stored) : null;

  if (!user || !user.id) {
    window.location.href = "/login";
    return;
  }

  const role = (user.role || "").toLowerCase();
  if (role !== "admin" && role !== "administrator") {
    window.location.href = "/login";
    return;
  }

  const nameEl = document.getElementById("userName");
  if (nameEl) nameEl.textContent = user.name || "Admin";

  const initialsEl = document.getElementById("userInitials");
  if (initialsEl && user.name) {
    const parts = user.name.trim().split(" ");
    initialsEl.textContent =
      ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "A";
  }

  const setText = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v ?? "—";
  };

  async function fetchJson(url, options = {}) {
    try {
      const res = await fetch(url, options);
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        return { success: false, message: "Server error " + res.status };
      }
      if (!contentType.includes("application/json")) {
        return { success: false, message: "Invalid response from server" };
      }
      return await res.json();
    } catch (err) {
      console.error(err);
      return { success: false, message: "Network error" };
    }
  }

  const titles = {
    overview: "Dashboard",
    doctors: "Doctors",
    pharmacists: "Pharmacists",
    patients: "Patients",
    appointments: "Appointments",
    invoices: "Invoices",
    messages: "Messages"
  };

  function showSection(id) {
    document.querySelectorAll(".dash-section").forEach((s) =>
      s.classList.remove("active-section")
    );
    document.getElementById("section-" + id)?.classList.add("active-section");

    document.querySelectorAll(".nav-item").forEach((a) => {
      a.classList.toggle("active", a.dataset.section === id);
    });

    const title = document.getElementById("pageTitle");
    if (title) title.textContent = titles[id] || "Dashboard";

    document.getElementById("sidebar")?.classList.remove("active");
    document.getElementById("sidebarOverlay")?.classList.remove("active");

    if (id === "doctors") renderDoctors();
    if (id === "pharmacists") renderPharmacists();
    if (id === "patients") renderPatients();
    if (id === "appointments") renderAppointments();
    if (id === "invoices") renderInvoices();
    if (id === "messages") renderMessages();
  }

  document.querySelectorAll(".nav-item").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      if (link.dataset.section) showSection(link.dataset.section);
    });
  });

  document.getElementById("menuBtn")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.toggle("active");
    document.getElementById("sidebarOverlay")?.classList.toggle("active");
  });

  document.getElementById("sidebarOverlay")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.remove("active");
    document.getElementById("sidebarOverlay")?.classList.remove("active");
  });

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("joburg_current_user");
    window.location.href = "/login";
  });


  async function renderDoctors() {
    const tbody = document.getElementById("doctorsBody");
    if (!tbody) return;

    const data = await fetchJson("/api/doctors");
    const list = data.success ? data.doctors || [] : [];
    setText("statDoctors", String(list.length));

    if (!list.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center;color:#64748B;">No doctors</td></tr>';
      return;
    }

    tbody.innerHTML = list
      .map((d) => {
        const status = d.availability || d.availability_status || "Available";
        const statusClass =
          String(status).toLowerCase().includes("available") ||
          String(status).toLowerCase().includes("on")
            ? "status-available"
            : "status-unavailable";
        const days = Array.isArray(d.available_days)
          ? d.available_days.join(", ")
          : d.available_days || "—";

        return `
          <tr>
            <td>${d.doctor_id || "—"}</td>
            <td>${d.full_name || "—"}</td>
            <td>${d.specialization || "—"}</td>
            <td>R ${Number(d.consultation_fee_first_visit || 0).toFixed(2)} / R ${Number(
              d.consultation_fee_follow_up || 0
            ).toFixed(2)}</td>
            <td><span class="status-pill ${statusClass}">${status}</span></td>
            <td>${days}</td>
          </tr>`;
      })
      .join("");
  }

 
  async function renderPharmacists() {
    const tbody = document.getElementById("pharmacistsBody");
    if (!tbody) return;

    const data = await fetchJson("/api/pharmacists");
    const list = data.success ? data.pharmacists || [] : [];

    if (!list.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center;color:#64748B;">No pharmacists</td></tr>';
      return;
    }

    tbody.innerHTML = list
      .map((p) => {
        const duty = p.duty_status || "—";
        const dutyClass = String(duty).toLowerCase().includes("on duty")
          ? "status-available"
          : "status-unavailable";
        return `
          <tr>
            <td>${p.pharmacist_id || p.user_id || "—"}</td>
            <td>${p.full_name || p.name || "—"}</td>
            <td>${p.email || "—"}</td>
            <td>${p.phone || "—"}</td>
            <td><span class="status-pill ${dutyClass}">${duty}</span></td>
          </tr>`;
      })
      .join("");
  }


  async function renderPatients() {
    const tbody = document.getElementById("patientsBody");
    if (!tbody) return;

    const data = await fetchJson("/api/patients");
    const list = data.success ? data.patients || [] : [];
    setText("statPatients", String(list.length));

    if (!list.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center;color:#64748B;">No patients</td></tr>';
      return;
    }

    tbody.innerHTML = list
      .map((p) => {
        const full =
          p.full_name ||
          ((p.first_name || "") + " " + (p.last_name || "")).trim() ||
          "—";
        return `
          <tr>
            <td>${p.id_number || "—"}</td>
            <td>${full}</td>
            <td>${p.email || "—"}</td>
            <td>${p.phone || "—"}</td>
            <td>${p.payment_method || "—"}</td>
          </tr>`;
      })
      .join("");
  }

  // ========== APPOINTMENTS + GENERATE INVOICE ==========
  let selectedAppointment = null;

  async function renderAppointments() {
    const tbody = document.getElementById("appointmentsBody");
    if (!tbody) return;

    const data = await fetchJson("/api/appointments");
    const list = data.success ? data.appointments || [] : [];
    setText("statAppointments", String(list.length));

    if (!list.length) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center;color:#64748B;">No appointments</td></tr>';
      return;
    }

    tbody.innerHTML = list
      .map((a) => {
        const st = (a.status || "Pending").toLowerCase();
        const badge =
          st === "confirmed" || st === "completed"
            ? "status-available"
            : st === "cancelled"
            ? "status-unavailable"
            : "status-new";

        const visit = String(a.visit_type || "").toLowerCase();
        const fee =
          visit.includes("follow") || visit.includes("second")
            ? Number(a.consultation_fee_follow_up || 0)
            : Number(a.consultation_fee_first_visit || 0);

        return `
          <tr>
            <td>${a.patient_name || a.id_number || "—"}</td>
            <td>${a.doctor_name || "—"}</td>
            <td>${a.appointment_date || "—"}</td>
            <td>${a.appointment_time || "—"}</td>
            <td><span class="status-pill ${badge}">${a.status || "Pending"}</span></td>
            <td>${a.visit_type || "—"}</td>
            <td>
              <button type="button" class="btn btn-primary btn-sm btn-generate-bill"
                data-id="${a.appointment_id}"
                data-patient="${(a.patient_name || "").replace(/"/g, "&quot;")}"
                data-idnumber="${a.id_number || ""}"
                data-doctor="${(a.doctor_name || "").replace(/"/g, "&quot;")}"
                data-fee="${fee}"
                data-visit="${(a.visit_type || "First Visit").replace(/"/g, "&quot;")}">
                <i class="fas fa-file-invoice"></i> Invoice
              </button>
            </td>
          </tr>`;
      })
      .join("");

    tbody.querySelectorAll(".btn-generate-bill").forEach((btn) => {
      btn.addEventListener("click", () => openGenerateBillModal(btn.dataset));
    });
  }

  async function openGenerateBillModal(data) {
    selectedAppointment = {
      appointment_id: data.id,
      id_number: data.idnumber,
      patient_name: data.patient,
      doctor_name: data.doctor,
      consultation_fee: Number(data.fee) || 0,
      visit_type: data.visit || "First Visit",
      pharmacy_fee: 0
    };

    setText("billPatientName", selectedAppointment.patient_name || "—");
    setText("billDoctorName", selectedAppointment.doctor_name || "—");
    setText("billVisitType", selectedAppointment.visit_type);
    setText("billConsultationFee", selectedAppointment.consultation_fee.toFixed(2));
    setText("billPharmacyFee", "0.00");
    setText("billTotalAmount", selectedAppointment.consultation_fee.toFixed(2));

    const methodEl = document.getElementById("billPaymentMethod");
    if (methodEl) methodEl.value = "Cash";

    if (selectedAppointment.id_number) {
      const ph = await fetchJson(
        "/api/pharmacy-sales/pending-total?id_number=" +
          encodeURIComponent(selectedAppointment.id_number)
      );
      const pharmacy = ph.success ? Number(ph.total) || 0 : 0;
      selectedAppointment.pharmacy_fee = pharmacy;
      setText("billPharmacyFee", pharmacy.toFixed(2));
      setText(
        "billTotalAmount",
        (selectedAppointment.consultation_fee + pharmacy).toFixed(2)
      );
    }

    const modal = document.getElementById("generateBillModal");
    if (modal) modal.style.display = "flex";
  }

  function closeGenerateBillModal() {
    const modal = document.getElementById("generateBillModal");
    if (modal) modal.style.display = "none";
    selectedAppointment = null;
  }

  document
    .getElementById("cancelGenerateBill")
    ?.addEventListener("click", closeGenerateBillModal);

  document
    .getElementById("confirmGenerateBillBtn")
    ?.addEventListener("click", async () => {
      if (!selectedAppointment) {
        alert("No appointment selected.");
        return;
      }
      if (!selectedAppointment.id_number) {
        alert("Patient ID number is missing. Cannot generate invoice.");
        return;
      }

      const paymentMethod =
        document.getElementById("billPaymentMethod")?.value || "Cash";
      const consult = Number(selectedAppointment.consultation_fee) || 0;
      const pharmacy = Number(selectedAppointment.pharmacy_fee) || 0;

      const payload = {
        id_number: selectedAppointment.id_number,
        appointment_id: Number(selectedAppointment.appointment_id),
        visit_type: selectedAppointment.visit_type || "First Visit",
        consultation_fee: consult,
        pharmacy_fee: pharmacy,
        other_charges: 0,
        total_amount: consult + pharmacy,
        payment_method: paymentMethod,
        payment_status: "Pending"
      };

      const result = await fetchJson("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (result.success) {
        alert(
          "Invoice generated.\nConsultation: R " +
            consult.toFixed(2) +
            "\nPharmacy: R " +
            pharmacy.toFixed(2) +
            "\nTotal: R " +
            (consult + pharmacy).toFixed(2)
        );
        closeGenerateBillModal();
        renderInvoices();
        showSection("invoices");
      } else {
        alert(result.message || "Failed to generate invoice.");
      }
    });

 
  async function renderInvoices() {
    const tbody = document.getElementById("invoicesBody");
    if (!tbody) return;

    const data = await fetchJson("/api/bills");
    const list = data.success ? data.bills || [] : [];

    if (!list.length) {
      tbody.innerHTML =
        '<tr><td colspan="9" style="text-align:center;color:#64748B;">No invoices</td></tr>';
      return;
    }

    tbody.innerHTML = list
      .map((b) => {
        const date = b.bill_date ? String(b.bill_date).slice(0, 10) : "—";
        const status = b.payment_status || "Pending";
        const consult = Number(b.consultation_fee || 0).toFixed(2);
        const pharmacy = Number(b.pharmacy_fee || 0).toFixed(2);
        const total = Number(b.total_amount || 0).toFixed(2);

        let statusClass = "status-pending";
        if (status === "Paid") statusClass = "status-paid";
        else if (status === "Claimed") statusClass = "status-claimed";

        let actions = `<span class="status-pill ${statusClass}">${status}</span>`;
        if (status === "Pending") {
          actions = `
            <button type="button" class="btn btn-primary btn-sm btn-bill-status"
              data-id="${b.bill_id}" data-status="Paid">Paid</button>
            <button type="button" class="btn btn-outline btn-sm btn-bill-status"
              data-id="${b.bill_id}" data-status="Claimed">Claimed</button>`;
        }

        return `
          <tr>
            <td>#${b.bill_id}</td>
            <td>${b.patient_name || b.id_number || "—"}</td>
            <td>${b.doctor_name || "—"}</td>
            <td>R ${consult}</td>
            <td>R ${pharmacy}</td>
            <td><strong>R ${total}</strong></td>
            <td><span class="status-pill ${statusClass}">${status}</span></td>
            <td>${date}</td>
            <td style="white-space:nowrap;">${actions}</td>
          </tr>`;
      })
      .join("");

    tbody.querySelectorAll(".btn-bill-status").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const status = btn.dataset.status;
        if (!confirm("Mark invoice #" + id + " as " + status + "?")) return;

        const result = await fetchJson("/api/bills/" + id + "/status", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status })
        });

        if (result.success) {
          alert("Invoice marked as " + status);
          renderInvoices();
        } else {
          alert(result.message || "Failed to update status.");
        }
      });
    });
  }


  let currentMsgId = null;
  let currentFolder = "inbox";
  let messagesCache = [];

  function openNewMsgModal() {
    const m = document.getElementById("newMsgModal");
    if (m) m.style.display = "flex";
  }
  function closeNewMsgModal() {
    const m = document.getElementById("newMsgModal");
    if (m) m.style.display = "none";
    document.getElementById("adminComposeForm")?.reset();
  }
  document.getElementById("btnNewMessage")?.addEventListener("click", openNewMsgModal);
  document.getElementById("closeNewMsgModal")?.addEventListener("click", closeNewMsgModal);
  document.getElementById("cancelNewMsg")?.addEventListener("click", closeNewMsgModal);

  document.getElementById("adminComposeForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("newMsgName")?.value.trim() || "Hospital Admin";
    const email = document.getElementById("newMsgEmail")?.value.trim();
    const subject = document.getElementById("newMsgSubject")?.value.trim();
    const message = document.getElementById("newMsgBody")?.value.trim();

    if (!email || !subject || !message) {
      alert("Email, subject and message are required.");
      return;
    }

    const data = await fetchJson("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: name, email, subject, message })
    });

    if (data.success) {
      alert("Message sent.");
      closeNewMsgModal();
      renderMessages();
    } else {
      alert(data.message || "Failed to send.");
    }
  });

  function openMsgModal() {
    const m = document.getElementById("msgModal");
    if (m) m.style.display = "flex";
  }
  function closeMsgModal() {
    const m = document.getElementById("msgModal");
    if (m) m.style.display = "none";
    currentMsgId = null;
    const formBox = document.getElementById("adminReplyFormBox");
    if (formBox) formBox.style.display = "none";
    const input = document.getElementById("adminReplyInput");
    if (input) input.value = "";
  }
  document.getElementById("closeMsgModal")?.addEventListener("click", closeMsgModal);
  document.getElementById("btnCloseMsgModal2")?.addEventListener("click", closeMsgModal);

  function viewMessage(m) {
    currentMsgId = m.message_id || m.id;

    setText("msgFrom", m.full_name || m.name || "—");
    setText("msgEmail", m.email || "—");
    setText("msgSubject", m.subject || "—");
    setText(
      "msgDate",
      m.created_at ? String(m.created_at).slice(0, 19).replace("T", " ") : "—"
    );

    const body = document.getElementById("msgBody");
    if (body) body.textContent = m.message || "—";

    const statusEl = document.getElementById("msgStatus");
    let status = m.status || "New";
    let pillClass = "status-new";
    if (m.patient_reply) {
      status = "Patient Replied";
      pillClass = "status-patient";
    } else if (m.admin_reply || status === "Replied") {
      status = "Replied";
      pillClass = "status-replied";
    } else if (status === "Read") {
      pillClass = "status-read";
    }
    if (statusEl) {
      statusEl.textContent = status;
      statusEl.className = "status-pill " + pillClass;
    }

    const adminBox = document.getElementById("adminReplyBox");
    const adminText = document.getElementById("adminReplyText");
    if (m.admin_reply) {
      if (adminBox) adminBox.style.display = "block";
      if (adminText) adminText.textContent = m.admin_reply;
    } else if (adminBox) {
      adminBox.style.display = "none";
    }

    const patientBox = document.getElementById("adminPatientReplyBox");
    const patientText = document.getElementById("adminPatientReplyText");
    if (m.patient_reply) {
      if (patientBox) patientBox.style.display = "block";
      if (patientText) patientText.textContent = m.patient_reply;
    } else if (patientBox) {
      patientBox.style.display = "none";
    }

    const archiveLabel = document.getElementById("archiveBtnLabel");
    if (archiveLabel) {
      archiveLabel.textContent = currentFolder === "archive" ? "Restore" : "Archive";
    }

    const formBox = document.getElementById("adminReplyFormBox");
    if (formBox) formBox.style.display = "none";

    openMsgModal();
  }

  document.getElementById("btnShowAdminReply")?.addEventListener("click", () => {
    const formBox = document.getElementById("adminReplyFormBox");
    if (formBox) formBox.style.display = "block";
  });
  document.getElementById("btnCancelAdminReply")?.addEventListener("click", () => {
    const formBox = document.getElementById("adminReplyFormBox");
    if (formBox) formBox.style.display = "none";
    const input = document.getElementById("adminReplyInput");
    if (input) input.value = "";
  });

  document.getElementById("btnSendAdminReply")?.addEventListener("click", async () => {
    if (!currentMsgId) return;
    const text = document.getElementById("adminReplyInput")?.value.trim();
    if (!text) {
      alert("Please type a reply.");
      return;
    }

    const data = await fetchJson("/api/contact/messages/" + currentMsgId + "/reply", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: text })
    });

    if (data.success) {
      alert("Reply sent.");
      closeMsgModal();
      renderMessages();
    } else {
      alert(data.message || "Failed to send reply.");
    }
  });

  document.getElementById("btnArchiveMsg")?.addEventListener("click", async () => {
    if (!currentMsgId) return;
    const toArchive = currentFolder !== "archive";

    const data = await fetchJson("/api/contact/messages/" + currentMsgId + "/archive", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: toArchive })
    });

    if (data.success) {
      closeMsgModal();
      renderMessages();
    } else {
      alert(data.message || "Failed.");
    }
  });

  document.getElementById("btnInbox")?.addEventListener("click", () => {
    currentFolder = "inbox";
    document.getElementById("btnInbox")?.classList.add("active-folder");
    document.getElementById("btnArchiveFolder")?.classList.remove("active-folder");
    renderMessages();
  });
  document.getElementById("btnArchiveFolder")?.addEventListener("click", () => {
    currentFolder = "archive";
    document.getElementById("btnArchiveFolder")?.classList.add("active-folder");
    document.getElementById("btnInbox")?.classList.remove("active-folder");
    renderMessages();
  });

  async function renderMessages() {
    const tbody = document.getElementById("messagesBody");
    if (!tbody) return;

    const archived = currentFolder === "archive" ? "1" : "0";
    const data = await fetchJson("/api/contact/messages?archived=" + archived);
    const list = data.success ? data.messages || [] : [];
    messagesCache = list;

    const badge = document.getElementById("msgBadge");
    if (badge) {
      const inboxData = await fetchJson("/api/contact/messages?archived=0");
      const inboxList = inboxData.success ? inboxData.messages || [] : [];
      const unread = inboxList.filter((m) => {
        const s = (m.status || "").toLowerCase();
        return s === "new" || s === "patient replied" || m.patient_reply;
      }).length;
      setText("statMessages", String(inboxList.length));
      if (unread > 0) {
        badge.style.display = "inline-block";
        badge.textContent = String(unread);
      } else {
        badge.style.display = "none";
      }
    }

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#64748B;">
        ${currentFolder === "archive" ? "No archived messages" : "No messages yet"}
      </td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((m) => {
        const id = m.message_id || m.id;
        let status = m.status || "New";
        let pillClass = "status-new";

        if (m.patient_reply) {
          status = "Patient Replied";
          pillClass = "status-patient";
        } else if (m.admin_reply || status === "Replied") {
          status = "Replied";
          pillClass = "status-replied";
        } else if (status === "Read") {
          pillClass = "status-read";
        }

        return `
          <tr>
            <td>#${id}</td>
            <td>${m.full_name || m.name || "—"}</td>
            <td>${m.email || "—"}</td>
            <td>${m.subject || "—"}</td>
            <td><span class="status-pill ${pillClass}">${status}</span></td>
            <td>${m.created_at ? String(m.created_at).slice(0, 19).replace("T", " ") : "—"}</td>
            <td>
              <button type="button" class="btn btn-primary btn-sm btn-view-msg" data-id="${id}">Open</button>
            </td>
          </tr>`;
      })
      .join("");

    tbody.querySelectorAll(".btn-view-msg").forEach((btn) => {
      btn.addEventListener("click", () => {
        const msg = messagesCache.find(
          (m) => String(m.message_id || m.id) === String(btn.dataset.id)
        );
        if (msg) viewMessage(msg);
      });
    });
  }


  renderDoctors();
  renderPharmacists();
  renderPatients();
  renderAppointments();
  renderInvoices();
  renderMessages();
  showSection("overview");
});
