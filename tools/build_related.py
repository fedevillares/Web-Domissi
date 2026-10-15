"""Genera js/related-data.js: categorías sugeridas según lo que se está mirando.
Fuente: 'Tabla de relaciones para mostrar categorias sugeridas.xlsx' (transcripta acá, ids de catalog-data.js).
Regla: [categoría, subcategoría|None, tipo|None] → lista de sugeridas con la misma forma.
Una regla aplica cuando la vista actual coincide en cada nivel que la regla define (nivel vacío = cualquiera).
Validar:  python tools/build_related.py
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

R = [
    # Hierros y Mallas › Barra ADN Nervurado
    (("hierros-mallas", "barra-adn-nervurado", None), [
        ("alambres-clavos", "alambres", "alambre-negro-recocido"),
        ("alambres-clavos", "clavos", "punta-paris"),
        ("alambres-clavos", "clavos", "punta-cajonero")]),
    # Laminados › Redondos › Herrero  <->  ANG/PLAN/T/U › Planchuelas perforadas
    (("laminados", "laminados-redondos", "lam-red-herrero"), [
        ("angulos-planchuelas", "planchuelas-perforadas", None)]),
    (("angulos-planchuelas", "planchuelas-perforadas", None), [
        ("laminados", "laminados-redondos", "lam-red-herrero")]),
    # Tejidos › Tejido Romboidal
    (("tejidos", "tejidos", "tejido-romboidal"), [
        ("tejidos", "accesorios-para-tejidos", None),
        ("alambres-clavos", "alambres", "alambre-galvanizado"),
        ("alambres-clavos", "alambres-rurales", "alambres-rurales"),
        ("alambres-clavos", "accesorios-para-alambrados", "torniquetas")]),
    # Chapas conformadas (toda la categoría)
    (("chapas-conformadas", None, None), [
        ("tornillos", "tornillos-autoperforantes", "tornillos-autoperforantes"),
        ("aislantes", None, None),
        ("complementos-techo", "zingueria", "cenefas-terminaciones"),
        ("complementos-techo", "zingueria", "cumbreras"),
        ("complementos-techo", "compriband", None)]),
    # Chapas conformadas › plásticas
    (("chapas-conformadas", "chapa-conformada-plastica", None), [
        ("tornillos", "tornillos-autoperforantes", "tornillos-autoperforantes"),
        ("tornillos", "tornillos-autoperforantes", "accesorios-p-autoperforantes")]),
]

s = open(os.path.join(ROOT, "js", "catalog-data.js"), encoding="utf-8").read()
cats = json.loads(re.search(r"DOMISSI_CATALOG\s*=\s*(\[.*?\]);[ \t]*$", s, re.M).group(1))
tree = {c["id"]: {sb["id"]: {g["id"] for g in sb["groups"]} for sb in c["sub"]} for c in cats}


def check(t):
    c, sb, g = t
    assert c in tree, c
    if sb:
        assert sb in tree[c], t
    if g:
        assert g in tree[c][sb], t


out = []
for f, ts in R:
    check(f)
    for t in ts:
        check(t)
    out.append({"f": list(f), "t": [list(t) for t in ts]})

js = ("/* Domissi Hermanos — categorías sugeridas.\n   ARCHIVO GENERADO por tools/build_related.py. "
      "Regla: f = [cat, sub, tipo] que se está mirando → t = sugeridas. null = cualquiera. */\n"
      "window.DOMISSI_RELATED = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
open(os.path.join(ROOT, "js", "related-data.js"), "w", encoding="utf-8", newline="\n").write(js)
print("ok:", len(out), "reglas")
