/* Domissi Hermanos — formulario de contacto
   No existe backend/CRM en el sitio anterior (auditoría confirmada), por lo que este
   formulario no promete un envío que no puede cumplir: valida los campos y abre el
   cliente de correo del visitante con el mensaje ya redactado a info@domissihermanos.com.ar.
   NOTA PARA CONFIGURACIÓN FUTURA: si se conecta un servicio de envío (Formspree, backend
   propio, etc.), reemplazar la función handleSubmit para hacer un fetch real y mantener
   la misma validación. */
(function () {
  "use strict";
  var form = document.getElementById("contactForm");
  if (!form) return;
  var status = document.getElementById("formStatus");

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
    var subject = "Consulta desde la web — " + interesLabel;
    var body =
      "Nombre: " + fields.nombre.el.value.trim() + "\n" +
      "Email: " + fields.email.el.value.trim() + "\n" +
      "Teléfono: " + (fields.telefono.el.value.trim() || "No indicado") + "\n" +
      "Motivo de consulta: " + interesLabel + "\n\n" +
      "Mensaje:\n" + fields.mensaje.el.value.trim();

    var mailto =
      "mailto:info@domissihermanos.com.ar?subject=" +
      encodeURIComponent(subject) +
      "&body=" +
      encodeURIComponent(body);

    window.location.href = mailto;

    status.textContent = "Abrimos tu cliente de correo con el mensaje listo para enviar a info@domissihermanos.com.ar.";
    status.classList.add("is-success");
  });
})();
