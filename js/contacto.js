/* Domissi Hermanos — formulario de contacto
   Envía la consulta a info@domissihermanos.com.ar a través de Web3Forms (POST JSON a
   api.web3forms.com). La access key es pública por diseño y se configura en el atributo
   data-web3forms-key del <form> (contacto.html). Si falta, o si el envío falla, se cae
   al cliente de correo del visitante (mailto:) con el mensaje ya redactado, así que la
   consulta nunca se pierde. */
(function () {
  "use strict";
  var form = document.getElementById("contactForm");
  if (!form) return;
  var status = document.getElementById("formStatus");
  var submit = form.querySelector("[type=submit]");
  var TO = "info@domissihermanos.com.ar";
  var ENDPOINT = "https://api.web3forms.com/submit";

  var fields = {
    nombre: { el: document.getElementById("nombre"), required: true },
    email: { el: document.getElementById("email"), required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    telefono: { el: document.getElementById("telefono"), required: false },
    interes: { el: document.getElementById("interes"), required: true },
    mensaje: { el: document.getElementById("mensaje"), required: true }
  };

  function setError(key, show) {
    var wrapper = fields[key].el.closest(".field");
    wrapper.classList.toggle("has-error", show);
  }

  function validate() {
    var valid = true;
    Object.keys(fields).forEach(function (key) {
      var f = fields[key];
      var value = f.el.value.trim();
      var ok = true;
      if (f.required && !value) ok = false;
      if (ok && f.pattern && value && !f.pattern.test(value)) ok = false;
      setError(key, !ok);
      if (!ok) valid = false;
    });
    return valid;
  }

  Object.keys(fields).forEach(function (key) {
    fields[key].el.addEventListener("blur", function () {
      var value = fields[key].el.value.trim();
      var ok = true;
      if (fields[key].required && !value) ok = false;
      if (ok && fields[key].pattern && value && !fields[key].pattern.test(value)) ok = false;
      setError(key, !ok);
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    status.className = "form-status";

    if (!validate()) {
      status.textContent = "Revisá los campos marcados antes de continuar.";
      status.classList.add("is-error");
      return;
    }

    var interesLabel = fields.interes.el.options[fields.interes.el.selectedIndex].text;
    var data = {
      nombre: fields.nombre.el.value.trim(),
      email: fields.email.el.value.trim(),
      telefono: fields.telefono.el.value.trim() || "No indicado",
      motivo: interesLabel,
      mensaje: fields.mensaje.el.value.trim()
    };
    var subject = "Consulta desde la web — " + interesLabel;
    var key = (form.getAttribute("data-web3forms-key") || "").trim();

    function showMailto() {
      var body =
        "Nombre: " + data.nombre + "\n" +
        "Email: " + data.email + "\n" +
        "Teléfono: " + data.telefono + "\n" +
        "Motivo de consulta: " + data.motivo + "\n\n" +
        "Mensaje:\n" + data.mensaje;
      window.location.href =
        "mailto:" + TO + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    }

    function done(ok, text) {
      submit.disabled = false;
      form.removeAttribute("aria-busy");
      status.textContent = text;
      status.classList.add(ok ? "is-success" : "is-error");
    }

    // Honeypot: un bot completa el checkbox oculto; se descarta sin avisar.
    if (form.elements.botcheck && form.elements.botcheck.checked) return;

    if (!key) {
      showMailto();
      status.textContent = "Abrimos tu cliente de correo con el mensaje listo para enviar a " + TO + ".";
      status.classList.add("is-success");
      return;
    }

    submit.disabled = true;
    form.setAttribute("aria-busy", "true");
    status.textContent = "Enviando tu consulta…";

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: key,
        subject: subject,
        from_name: "Web Domissi Hermanos",
        name: data.nombre,
        email: data.email,
        telefono: data.telefono,
        motivo: data.motivo,
        message: data.mensaje,
        botcheck: ""
      })
    })
      .then(function (res) {
        return res.json().then(function (json) { return { ok: res.ok && json.success, json: json }; });
      })
      .then(function (r) {
        if (!r.ok) throw new Error((r.json && r.json.message) || "send failed");
        form.reset();
        done(true, "¡Gracias! Recibimos tu consulta y te respondemos a la brevedad al email que dejaste.");
      })
      .catch(function () {
        done(false, "No pudimos enviar la consulta. Probá de nuevo, escribinos a " + TO + " o hablá con un asesor por WhatsApp.");
      });
  });
})();
