"""Genera sitemap.xml, robots.txt, llms.txt y llms-full.txt a partir de js/catalog-data.js y js/products-data.js.
Ejecutar después de tools/build_catalog.py:  python tools/build_seo.py
"""
import json, re, os
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://domissihermanos.com.ar"
TODAY = date.today().isoformat()


def load(name, var):
    s = open(os.path.join(ROOT, "js", name), encoding="utf-8").read()
    m = re.search(r"window\." + var + r"\s*=\s*(\[.*?\]);[ \t]*$", s, re.M)
    return json.loads(m.group(1))


groups = load("catalog-data.js", "DOMISSI_GROUPS")
cats = load("catalog-data.js", "DOMISSI_CATALOG")
prods = load("products-data.js", "DOMISSI_PRODUCTS")
total = len(prods)


def w(name, text):
    open(os.path.join(ROOT, name), "w", encoding="utf-8", newline="\n").write(text)


def fmt(v):
    return ("%g" % v).replace(".", ",")


# ---------- robots.txt
bots = ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-User", "Claude-SearchBot",
        "anthropic-ai", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended"]
robots = "# Domissi Hermanos — domissihermanos.com.ar\n# Sitio abierto a buscadores y a agentes de IA.\n" \
         "# Resumen para LLMs: /llms.txt · Catálogo completo en texto: /llms-full.txt\n\nUser-agent: *\nAllow: /\n\n" \
         "# Rastreadores y agentes de IA: permitidos explícitamente\n"
robots += "".join("User-agent: %s\nAllow: /\n\n" % b for b in bots)
robots += "Sitemap: %s/sitemap.xml\n" % SITE
w("robots.txt", robots)

# ---------- sitemap.xml
urls = [("/", "1.0", "weekly"), ("/productos.html", "0.9", "weekly"), ("/buscar.html", "0.5", "monthly"),
        ("/empresa.html", "0.6", "yearly"), ("/contacto.html", "0.7", "yearly")]
urls += [("/productos.html?c=" + c["id"], "0.8", "weekly") for c in cats]
x = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for loc, pr, cf in urls:
    x.append("  <url>\n    <loc>%s%s</loc>\n    <lastmod>%s</lastmod>\n    <changefreq>%s</changefreq>\n    <priority>%s</priority>\n  </url>"
             % (SITE, loc.replace("&", "&amp;"), TODAY, cf, pr))
x.append("</urlset>\n")
w("sitemap.xml", "\n".join(x))

# ---------- llms.txt
L = ["# Domissi Hermanos", "",
     "> Distribuidora de aceros para la construcción y la industria, con 50 años de trayectoria en Casilda, sur de Santa Fe, Argentina. "
     "Vende hierros, mallas, perfiles, chapas, caños, aislantes y ferretería, con flota propia de entrega en Santa Fe y Córdoba. "
     "Catálogo actual: %d productos en %d categorías." % (total, len(cats)), "",
     "Atiende a obra (constructoras y clientes finales), industria (PYMES metalúrgicas) y mayoristas (corralones, herrerías, ferreterías, cooperativas).", "",
     "## Páginas principales", "",
     "- [Inicio](%s/): presentación, propuesta de valor y accesos rápidos." % SITE,
     "- [Catálogo de productos](%s/productos.html): %d productos con código, medidas, largo y peso." % (SITE, total),
     "- [Buscador](%s/buscar.html): búsqueda por texto, p. ej. `buscar.html?q=planchuela 1 1/4`." % SITE,
     "- [Empresa](%s/empresa.html): historia, flota propia y valores." % SITE,
     "- [Contacto](%s/contacto.html): formulario de presupuesto, teléfono, email y dirección." % SITE, "",
     "## Categorías del catálogo", ""]
for c in cats:
    L.append("- [%s](%s/productos.html?c=%s): %d productos." % (c["label"], SITE, c["id"], c["count"]))
L += ["", "## Opcional", "",
      "- [Catálogo completo en texto](%s/llms-full.txt): todas las categorías, subcategorías y productos con sus medidas." % SITE,
      "- [Sitemap](%s/sitemap.xml)" % SITE, "",
      "## Datos de contacto", "",
      "- Teléfono: +54 3464 45-5600",
      "- WhatsApp: https://wa.me/5493464609089",
      "- Email: info@domissihermanos.com.ar",
      "- Dirección: Blvd. Colón 2499, S2170 Casilda, Santa Fe, Argentina",
      "- Horario: lunes a viernes 8:00–12:00 y 14:30–18:30; sábados 8:00–11:00 (hora de Argentina)", "",
      "## Notas para agentes", "",
      "- Los precios no se publican: para cotizar, derivar al WhatsApp o al formulario de contacto.",
      "- La interfaz del catálogo se renderiza con JavaScript; para leer el catálogo sin ejecutar JS usar `llms-full.txt`.",
      "- Parámetros de URL del catálogo: `productos.html?c=<categoría>&s=<subcategoría>&g=<agrupador>&a=<ancho mm>&e=<espesor mm>&q=<texto>`.",
      "- Los filtros de ancho y espesor existen solo donde hay datos: Ángulos/planchuelas/perfiles T/U (ancho y espesor) y Caños (espesor).",
      "- Zona de reparto declarada: sur de Santa Fe y Córdoba. No hay sucursales fuera de Casilda.", ""]
w("llms.txt", "\n".join(L))

# ---------- llms-full.txt
F = ["# Domissi Hermanos — catálogo completo", "",
     "> Fuente: %s/productos.html · %d productos activos · actualizado %s." % (SITE, total, TODAY),
     "> Sin precios publicados: cotizar por WhatsApp (https://wa.me/5493464609089) o %s/contacto.html." % SITE,
     "> Columnas de cada producto: código · descripción · venta por · largo (m) · peso (kg/un.)"
     " · ancho (mm) y espesor (mm) cuando corresponde.", ""]
by = {}
for r in prods:
    by.setdefault((r[2], r[3]), []).append(r)
for gi, gname in enumerate(groups):
    F += ["## " + gname, ""]
    for ci, c in enumerate(cats):
        if c["group"] != gi:
            continue
        F += ["### %s (%d)" % (c["label"], c["count"]), "", "URL: %s/productos.html?c=%s" % (SITE, c["id"]), ""]
        for si, s in enumerate(c["sub"]):
            F.append("#### %s (%d)" % (s["label"], s["count"]))
            for r in by.get((ci, si), []):
                parts = [str(r[0]), r[1], "venta por " + str(r[5]).lower()]
                if r[6]:
                    parts.append("largo " + fmt(r[6]) + " m")
                if r[7]:
                    parts.append(fmt(r[7]) + " kg")
                if len(r) > 8 and r[8] is not None:
                    parts.append("ancho " + fmt(r[8]) + " mm")
                if len(r) > 9 and r[9] is not None:
                    parts.append("espesor " + fmt(r[9]) + " mm")
                F.append("- " + " · ".join(parts))
            F.append("")
w("llms-full.txt", "\n".join(F))
print("ok:", total, "productos,", len(cats), "categorías")
