document.addEventListener("DOMContentLoaded", () => {
  const stored = localStorage.getItem("joburg_current_user");
  const user = stored ? JSON.parse(stored) : null;

  if (!user?.id) {
    window.location.href = "/login";
    return;
  }
  if ((user.role || "").toLowerCase() !== "patient") {
    window.location.href = "/login";
    return;
  }

  
  const nameEl = document.getElementById("userName");
  if (nameEl) nameEl.textContent = user.name || "Patient";

  const initialsEl = document.getElementById("userInitials");
  if (initialsEl && user.name) {
    const parts = user.name.trim().split(" ");
    initialsEl.textContent = ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "P";
  }

  
  const setText = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v || "—";
  };
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v || "";
  };
  const getVal = (id) => document.getElementById(id)?.value.trim() || "";

  async function fetchJson(url, options = {}) {
    try {
      const res = await fetch(url, options);
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) return { success: false, message: "Server error " + res.status };
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
    profile: "My Profile",
    messages: "Messages",
    book: "Book Appointment",
    appointments: "My Appointments",
    prescriptions: "Prescriptions",
    bills: "Bills"
  };

  function showSection(id) {
    document.querySelectorAll(".dash-section").forEach((s) => s.classList.remove("active-section"));
    document.getElementById("section-" + id)?.classList.add("active-section");

    document.querySelectorAll(".nav-item").forEach((a) => {
      a.classList.toggle("active", a.dataset.section === id);
    });

    const title = document.getElementById("pageTitle");
    if (title) title.textContent = titles[id] || "Dashboard";

    document.getElementById("sidebar")?.classList.remove("active");
    document.getElementById("sidebarOverlay")?.classList.remove("active");

    if (id === "messages") renderPatientMessages();
    if (id === "appointments") renderAppointments();
    if (id === "prescriptions") renderPatientPrescriptions();
    if (id === "bills") renderPatientBills();
    if (id === "profile") loadPatientProfileFromServer();
  }

  document.querySelectorAll(".nav-item").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      if (link.dataset.section) showSection(link.dataset.section);
    });
  });

  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (btn.dataset.goto) showSection(btn.dataset.goto);
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

  
  let profile = {
    id_number: "", first_name: "", last_name: "", email: user.email || "", phone: "",
    date_of_birth: "", gender: "", address: "", emergency_contact_name: "",
    emergency_contact_phone: "", blood_group: "", allergies: "", payment_method: "",
    payment_responsible: "", payment_relationship: "", medical_aid_name: "",
    medical_aid_number: "", medical_aid_plan: "", medical_aid_member: ""
  };

  function paymentDetailsText() {
    if (profile.payment_method === "Cash") {
      return (profile.payment_responsible || "—") + " (" + (profile.payment_relationship || "—") + ")";
    }
    if (profile.payment_method === "Medical Aid") {
      return [profile.medical_aid_name, profile.medical_aid_number ? "#" + profile.medical_aid_number : "", profile.medical_aid_plan]
        .filter(Boolean).join(" · ");
    }
    return "";
  }

  function renderView() {
    const full = (profile.first_name + " " + profile.last_name).trim() || user.name || "—";
    setText("viewIdNumber", profile.id_number);
    setText("viewFullName", full);
    setText("viewEmail", profile.email || user.email);
    setText("viewPhone", profile.phone);
    setText("viewDob", profile.date_of_birth);
    setText("viewGender", profile.gender);
    setText("viewAddress", profile.address);
    setText("viewEmergency", profile.emergency_contact_name
      ? profile.emergency_contact_name + " (" + (profile.emergency_contact_phone || "N/A") + ")" : "");
    setText("viewBloodGroup", profile.blood_group);
    setText("viewAllergies", profile.allergies || "None");
    setText("viewPaymentMethod", profile.payment_method);
    setText("viewPaymentDetails", paymentDetailsText());

    const statProfile = document.getElementById("statProfile");
    if (statProfile) {
      statProfile.textContent =
        profile.id_number && profile.phone && profile.address && profile.payment_method
          ? "Complete" : "Incomplete";
    }
  }

  function togglePaymentFields() {
    const method = document.getElementById("editPaymentMethod")?.value;
    document.getElementById("cashFields")?.classList.toggle("show", method === "Cash");
    document.getElementById("medicalAidFields")?.classList.toggle("show", method === "Medical Aid");
  }

  function fillForm() {
    setVal("editIdNumber", profile.id_number);
    setVal("editFirstName", profile.first_name);
    setVal("editLastName", profile.last_name);
    setVal("editPhone", profile.phone);
    setVal("editDob", profile.date_of_birth);
    setVal("editGender", profile.gender);
    setVal("editAddress", profile.address);
    setVal("editEmergencyName", profile.emergency_contact_name);
    setVal("editEmergencyPhone", profile.emergency_contact_phone);
    setVal("editBloodGroup", profile.blood_group);
    setVal("editAllergies", profile.allergies);
    setVal("editPaymentMethod", profile.payment_method);
    setVal("editPaymentResponsible", profile.payment_responsible);
    setVal("editPaymentRelationship", profile.payment_relationship);
    setVal("editMedicalAidName", profile.medical_aid_name);
    setVal("editMedicalAidNumber", profile.medical_aid_number);
    setVal("editMedicalAidPlan", profile.medical_aid_plan);
    setVal("editMedicalAidMember", profile.medical_aid_member);
    togglePaymentFields();
  }

  async function loadPatientProfileFromServer() {
    const data = await fetchJson("/api/profile/" + user.id);
    if (!data.success) {
      renderView();
      return;
    }
    const p = data.profile || {};
    const u = data.user || {};
    let first = p.first_name || "";
    let last = p.last_name || "";
    if (!first && !last && (u.full_name || user.name)) {
      const parts = (u.full_name || user.name).trim().split(" ");
      first = parts[0] || "";
      last = parts.slice(1).join(" ") || "";
    }
    profile = {
      id_number: p.id_number || u.id_number || "",
      first_name: first,
      last_name: last,
      email: u.email || p.email || user.email || "",
      phone: p.phone || u.phone || "",
      date_of_birth: p.date_of_birth || "",
      gender: p.gender || "",
      address: p.address || "",
      emergency_contact_name: p.emergency_contact_name || "",
      emergency_contact_phone: p.emergency_contact_phone || "",
      blood_group: p.blood_group || "",
      allergies: p.allergies || "",
      payment_method: p.payment_method || "",
      payment_responsible: p.payment_responsible || "",
      payment_relationship: p.payment_relationship || "",
      medical_aid_name: p.medical_aid_name || "",
      medical_aid_number: p.medical_aid_number || "",
      medical_aid_plan: p.medical_aid_plan || "",
      medical_aid_member: p.medical_aid_member || ""
    };
    renderView();
  }

  loadPatientProfileFromServer();

  const profileView = document.getElementById("profileView");
  const profileEdit = document.getElementById("profileEdit");
  const editBtn = document.getElementById("editProfileBtn");
  const cancelBtn = document.getElementById("cancelProfileBtn");

  editBtn?.addEventListener("click", () => {
    fillForm();
    if (profileView) profileView.style.display = "none";
    if (profileEdit) profileEdit.style.display = "block";
    if (editBtn) editBtn.style.display = "none";
  });

  cancelBtn?.addEventListener("click", () => {
    if (profileView) profileView.style.display = "block";
    if (profileEdit) profileEdit.style.display = "none";
    if (editBtn) editBtn.style.display = "inline-flex";
  });

  document.getElementById("editPaymentMethod")?.addEventListener("change", togglePaymentFields);

  document.getElementById("profileForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const method = getVal("editPaymentMethod");

    if (method === "Cash" && (!getVal("editPaymentResponsible") || !getVal("editPaymentRelationship"))) {
      alert("Please enter payment responsible details.");
      return;
    }
    if (method === "Medical Aid" && (!getVal("editMedicalAidName") || !getVal("editMedicalAidNumber"))) {
      alert("Please enter medical aid details.");
      return;
    }

    const payload = {
      first_name: getVal("editFirstName"),
      last_name: getVal("editLastName"),
      phone: getVal("editPhone"),
      address: getVal("editAddress") || null,
      date_of_birth: getVal("editDob") || null,
      gender: getVal("editGender") || null,
      blood_group: getVal("editBloodGroup") || null,
      emergency_contact_name: getVal("editEmergencyName") || null,
      emergency_contact_phone: getVal("editEmergencyPhone") || null,
      allergies: getVal("editAllergies") || null,
      payment_method: method || null,
      payment_responsible: getVal("editPaymentResponsible") || null,
      payment_relationship: getVal("editPaymentRelationship") || null,
      medical_aid_name: getVal("editMedicalAidName") || null,
      medical_aid_number: getVal("editMedicalAidNumber") || null,
      medical_aid_plan: getVal("editMedicalAidPlan") || null,
      medical_aid_member: getVal("editMedicalAidMember") || null
    };

    const data = await fetchJson("/api/patients/profile/" + user.id, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (data.success) {
      Object.assign(profile, payload);
      profile.phone = payload.phone || "";
      renderView();
      if (profileView) profileView.style.display = "block";
      if (profileEdit) profileEdit.style.display = "none";
      if (editBtn) editBtn.style.display = "inline-flex";
      alert("Profile saved successfully!");
    } else {
      alert(data.message || "Failed to save profile.");
    }
  });

 
  let currentPatientMsgId = null;
  let patientMessagesCache = [];

  // Remember which messages the patient has already opened
  function getReadIds() {
    try {
      return JSON.parse(localStorage.getItem("patient_read_msgs_" + user.id) || "[]");
    } catch {
      return [];
    }
  }
  function markAsRead(id) {
    const ids = getReadIds();
    if (!ids.includes(String(id))) {
      ids.push(String(id));
      localStorage.setItem("patient_read_msgs_" + user.id, JSON.stringify(ids));
    }
  }

  
  function openNewMessageModal() {
    const m = document.getElementById("newMessageModal");
    if (m) m.style.display = "flex";
  }
  function closeNewMessageModal() {
    const m = document.getElementById("newMessageModal");
    if (m) m.style.display = "none";
    document.getElementById("patientComposeForm")?.reset();
  }

  document.getElementById("btnNewMessage")?.addEventListener("click", openNewMessageModal);
  document.getElementById("closeNewMessageModal")?.addEventListener("click", closeNewMessageModal);
  document.getElementById("cancelNewMessage")?.addEventListener("click", closeNewMessageModal);

  
  function openPatientMsgModal() {
    const m = document.getElementById("patientMsgModal");
    if (m) m.style.display = "flex";
  }
  function closePatientMsgModal() {
    const m = document.getElementById("patientMsgModal");
    if (m) m.style.display = "none";
    currentPatientMsgId = null;
    const replyBox = document.getElementById("pReplyBox");
    if (replyBox) replyBox.style.display = "none";
    const replyText = document.getElementById("pReplyText");
    if (replyText) replyText.value = "";
  }

  document.getElementById("closePatientMsgModal")?.addEventListener("click", closePatientMsgModal);
  document.getElementById("cancelPatientMsgModal")?.addEventListener("click", closePatientMsgModal);

  function viewPatientMessage(m) {
    currentPatientMsgId = m.message_id || m.id;

    markAsRead(currentPatientMsgId);

    setText("pMsgSubject", m.subject || "—");
    setText("pMsgDate", m.created_at ? String(m.created_at).slice(0, 19).replace("T", " ") : "—");

    const statusEl = document.getElementById("pMsgStatus");
    if (statusEl) {
      const status = m.admin_reply ? "Replied" : "Sent";
      statusEl.textContent = status;
      statusEl.className = "status-pill " + (m.admin_reply ? "status-replied" : "status-sent");
    }

    const body = document.getElementById("pMsgBody");
    if (body) body.textContent = m.message || "—";

    const adminBox = document.getElementById("pAdminReplyBox");
    const adminText = document.getElementById("pAdminReply");
    if (m.admin_reply) {
      if (adminBox) adminBox.style.display = "block";
      if (adminText) adminText.textContent = m.admin_reply;
    } else if (adminBox) {
      adminBox.style.display = "none";
    }

    const replyBox = document.getElementById("pReplyBox");
    if (replyBox) replyBox.style.display = "none";

    openPatientMsgModal();

    
    renderPatientMessages();
  }

  
  document.getElementById("btnShowReplyBox")?.addEventListener("click", () => {
    const replyBox = document.getElementById("pReplyBox");
    if (replyBox) replyBox.style.display = "block";
  });
  document.getElementById("btnCancelPatientReply")?.addEventListener("click", () => {
    const replyBox = document.getElementById("pReplyBox");
    if (replyBox) replyBox.style.display = "none";
    const replyText = document.getElementById("pReplyText");
    if (replyText) replyText.value = "";
  });


  document.getElementById("btnSendPatientReply")?.addEventListener("click", async () => {
    if (!currentPatientMsgId) return;
    const text = document.getElementById("pReplyText")?.value.trim();
    if (!text) {
      alert("Please type a reply.");
      return;
    }

    const data = await fetchJson("/api/contact/messages/" + currentPatientMsgId + "/patient-reply", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, reply: text })
    });

    if (data.success) {
      alert("Reply sent successfully!");
      closePatientMsgModal();
      renderPatientMessages();
    } else {
      alert("Reply could not be saved yet. Backend route is missing (404).\nPlease add the patient-reply route on the server.");
    }
  });

 
  document.getElementById("patientComposeForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const subject = document.getElementById("composeSubject")?.value.trim();
    const message = document.getElementById("composeMessage")?.value.trim();

    if (!subject || !message) {
      alert("Subject and message are required.");
      return;
    }

    const fullName = (profile.first_name + " " + profile.last_name).trim() || user.name || "Patient";
    const email = profile.email || user.email || "";

    if (!email) {
      alert("No email on account. Please update your profile.");
      return;
    }

    const data = await fetchJson("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName,
        email,
        phone_number: profile.phone || "",
        subject,
        message
      })
    });

    if (data.success) {
      alert("Message sent successfully!");
      closeNewMessageModal();
      renderPatientMessages();
    } else {
      alert(data.message || "Failed to send message.");
    }
  });

 
  document.getElementById("deletePatientMsgBtn")?.addEventListener("click", async () => {
    if (!currentPatientMsgId) return;
    if (!confirm("Are you sure you want to delete this message?")) return;

    const data = await fetchJson("/api/contact/messages/" + currentPatientMsgId + "/delete", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id })
    });

    if (data.success) {
      closePatientMsgModal();
      renderPatientMessages();
    } else {
      alert(data.message || "Failed to delete message.");
    }
  });

  
  async function renderPatientMessages() {
    const tbody = document.getElementById("patientMessagesBody");
    if (!tbody) return;

    const data = await fetchJson("/api/contact/messages/my?userId=" + encodeURIComponent(user.id));
    const list = data.success ? data.messages || [] : [];
    patientMessagesCache = list;

    // Badge = messages that have a hospital reply AND the patient has NOT opened yet
    const readIds = getReadIds();
    const unreadCount = list.filter((m) => {
      const id = String(m.message_id || m.id);
      return m.admin_reply && !readIds.includes(id);
    }).length;

    const badge = document.getElementById("msgBadge");
    if (badge) {
      if (unreadCount > 0) {
        badge.style.display = "inline-block";
        badge.textContent = String(unreadCount);
      } else {
        badge.style.display = "none";
      }
    }

    if (!list.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>No messages yet</p>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = list.map((m) => {
      const id = m.message_id || m.id;
      const status = m.admin_reply ? "Replied" : "Sent";
      const pillClass = m.admin_reply ? "status-replied" : "status-sent";

      return `
        <tr>
          <td>#${id}</td>
          <td>${m.subject || "—"}</td>
          <td><span class="status-pill ${pillClass}">${status}</span></td>
          <td>${m.created_at ? String(m.created_at).slice(0, 19).replace("T", " ") : "—"}</td>
          <td>
            <div class="action-btns">
              <button type="button" class="btn btn-primary btn-sm btn-open-msg" data-id="${id}">Read</button>
              <button type="button" class="btn btn-outline btn-sm btn-del-msg" data-id="${id}">Delete</button>
            </div>
          </td>
        </tr>`;
    }).join("");

    
    tbody.querySelectorAll(".btn-open-msg").forEach((btn) => {
      btn.addEventListener("click", () => {
        const msg = patientMessagesCache.find(
          (m) => String(m.message_id || m.id) === String(btn.dataset.id)
        );
        if (msg) viewPatientMessage(msg);
      });
    });

  
    tbody.querySelectorAll(".btn-del-msg").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to delete this message?")) return;

        const data = await fetchJson("/api/contact/messages/" + btn.dataset.id + "/delete", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id })
        });

        if (data.success) {
          renderPatientMessages();
        } else {
          alert(data.message || "Failed to delete message.");
        }
      });
    });
  }

 
  let doctorsCache = [];

  function parseAvailableDays(doctor) {
    if (Array.isArray(doctor.available_days) && doctor.available_days.length) {
      return doctor.available_days;
    }
    if (typeof doctor.available_days === "string" && doctor.available_days.trim()) {
      return doctor.available_days.split(/[-–,]/).map((d) => d.trim()).filter(Boolean);
    }
    return ["Mon", "Tue", "Wed", "Thu", "Fri"];
  }

  function getDayName(dateStr) {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(dateStr + "T00:00:00").getDay()];
  }

  function isDoctorAvailableOnDate(doctorId, dateStr) {
    const doctor = doctorsCache.find((d) => String(d.doctor_id) === String(doctorId));
    if (!doctor || !dateStr) return false;
    return (doctor.available_days || []).includes(getDayName(dateStr));
  }

  function updateDoctorDaysHint() {
    const hint = document.getElementById("doctorDaysHint");
    const doctorId = document.getElementById("bookDoctor")?.value;
    if (!hint) return;
    if (!doctorId) {
      hint.style.display = "none";
      return;
    }
    const doctor = doctorsCache.find((d) => String(d.doctor_id) === String(doctorId));
    if (!doctor) {
      hint.style.display = "none";
      return;
    }
    hint.textContent = "Available: " + (doctor.available_days || []).join(" – ");
    hint.style.display = "block";
  }

  async function populateDoctors() {
    const sel = document.getElementById("bookDoctor");
    if (!sel) return;
    const data = await fetchJson("/api/doctors");
    if (data.success && data.doctors?.length) {
      doctorsCache = data.doctors.map((d) => ({
        ...d,
        available_days: parseAvailableDays(d)
      }));
      sel.innerHTML =
        '<option value="">Select a doctor</option>' +
        doctorsCache.map((d) => {
          return `<option value="${d.doctor_id}">${d.full_name} — ${d.specialization || "General"} (${d.available_days.join("–")})</option>`;
        }).join("");
    } else {
      sel.innerHTML = '<option value="">No doctors available</option>';
    }
  }
  populateDoctors();

  document.getElementById("bookDoctor")?.addEventListener("change", function () {
    const dateInput = document.getElementById("bookDate");
    const timeSel = document.getElementById("bookTime");
    if (dateInput) dateInput.value = "";
    if (timeSel) timeSel.innerHTML = '<option value="">Select date first</option>';
    updateDoctorDaysHint();
  });

  function buildTimeSlots() {
    const slots = [];
    for (let h = 8; h <= 17; h++) {
      for (const m of [0, 30]) {
        if (h === 17 && m === 30) break;
        slots.push(String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0"));
      }
    }
    return slots;
  }

  async function populateAvailableTimes() {
    const timeSel = document.getElementById("bookTime");
    const doctorId = document.getElementById("bookDoctor")?.value;
    const date = document.getElementById("bookDate")?.value;
    if (!timeSel) return;
    if (!doctorId || !date) {
      timeSel.innerHTML = '<option value="">Select doctor and date first</option>';
      return;
    }
    if (!isDoctorAvailableOnDate(doctorId, date)) {
      alert("This doctor is not available on the selected day.");
      document.getElementById("bookDate").value = "";
      timeSel.innerHTML = '<option value="">Select date first</option>';
      return;
    }
    const data = await fetchJson("/api/appointments/taken?doctorId=" + doctorId + "&date=" + date);
    const taken = new Set((data.takenTimes || []).map((t) => String(t).substring(0, 5)));
    const free = buildTimeSlots().filter((s) => !taken.has(s));
    timeSel.innerHTML = free.length
      ? '<option value="">Select time</option>' + free.map((t) => `<option value="${t}">${t}</option>`).join("")
      : '<option value="">No available times</option>';
  }

  const bookDate = document.getElementById("bookDate");
  if (bookDate) {
    bookDate.min = new Date().toISOString().split("T")[0];
    bookDate.addEventListener("change", populateAvailableTimes);
  }

  document.getElementById("bookForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!profile.id_number) {
      alert("Please complete your profile first (ID Number is required).");
      showSection("profile");
      return;
    }
    const doctorId = document.getElementById("bookDoctor")?.value;
    const date = getVal("bookDate");
    const time = getVal("bookTime");
    const reason = getVal("bookReason");
    if (!doctorId || !date || !time) {
      alert("Please select doctor, date and time.");
      return;
    }
    const data = await fetchJson("/api/appointments/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        doctorId: Number(doctorId),
        appointmentDate: date,
        appointmentTime: time,
        reason: reason || null
      })
    });
    if (data.success) {
      alert("Appointment booked successfully!");
      e.target.reset();
      renderAppointments();
      showSection("appointments");
    } else {
      alert(data.message || "Booking failed.");
    }
  });

  
  async function renderAppointments() {
    const tbody = document.getElementById("appointmentsTableBody");
    if (!tbody) return;
    const data = await fetchJson("/api/appointments/my?userId=" + user.id + "&role=patient");
    const list = data.success ? data.appointments || [] : [];
    setText("statAppointments", String(list.length));
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#64748B;">No appointments yet</td></tr>';
      return;
    }
    tbody.innerHTML = list.map((a) => {
      const st = (a.status || "Pending").toLowerCase();
      const badge = st === "confirmed" || st === "completed" ? "confirmed" : st === "cancelled" ? "cancelled" : "pending";
      return `
        <tr>
          <td>${a.doctor_name || "—"}</td>
          <td>${a.specialization || "—"}</td>
          <td>${a.appointment_date || "—"}</td>
          <td>${a.appointment_time || "—"}</td>
          <td><span class="badge-status ${badge}">${a.status || "Pending"}</span></td>
          <td>${a.reason || "—"}</td>
        </tr>`;
    }).join("");
  }

 
  async function renderPatientPrescriptions() {
    const tbody = document.getElementById("prescriptionsTableBody");
    if (!tbody) return;
    const data = await fetchJson("/api/prescriptions");
    let list = data.success ? data.prescriptions || [] : [];
    if (profile.id_number) {
      list = list.filter((r) => String(r.id_number) === String(profile.id_number));
    }
    setText("statPrescriptions", String(list.length));
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#64748B;">No prescriptions yet</td></tr>';
      return;
    }
    tbody.innerHTML = list.map((r) => {
      const badge = (r.status || "").toLowerCase() === "dispensed" ? "confirmed" : "pending";
      return `
        <tr>
          <td>#${r.prescription_id}</td>
          <td>${r.doctor_name || "—"}</td>
          <td>${r.medication || "—"}</td>
          <td>${r.quantity || "—"}</td>
          <td><span class="badge-status ${badge}">${r.status || "Pending"}</span></td>
        </tr>`;
    }).join("");
  }


  async function renderPatientBills() {
    const tbody = document.getElementById("billsTableBody");
    if (!tbody) return;
    const url = profile.id_number
      ? "/api/bills/patient?id_number=" + encodeURIComponent(profile.id_number)
      : "/api/bills/patient/" + user.id;
    const data = await fetchJson(url);
    const list = data.success ? data.bills || [] : [];
    const open = list.filter((b) => (b.payment_status || "").toLowerCase() !== "paid");
    setText("statBills", String(open.length));
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#64748B;">No bills yet</td></tr>';
      return;
    }
    tbody.innerHTML = list.map((b) => {
      const status = b.payment_status || "Pending";
      const badge = status === "Paid" ? "confirmed" : status === "Rejected" ? "cancelled" : "pending";
      return `
        <tr>
          <td>#${b.bill_id}</td>
          <td>${b.doctor_name || "—"}</td>
          <td>R ${Number(b.total_amount || 0).toFixed(2)}</td>
          <td>${b.payment_method || "—"}</td>
          <td><span class="badge-status ${badge}">${status}</span></td>
        </tr>`;
    }).join("");
  }


  renderAppointments();
  renderPatientPrescriptions();
  renderPatientBills();
  renderPatientMessages();
  showSection("overview");
});