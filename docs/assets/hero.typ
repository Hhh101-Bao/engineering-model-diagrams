#set page(width: 310mm, height: auto, margin: (x: 14mm, y: 12mm), fill: rgb("#F5F7FA"))
#set text(font: ("Arial", "Liberation Sans"), fill: rgb("#24384B"))
#text(size: 9pt, weight: "bold", tracking: 1.2pt, fill: rgb("#52738D"))[PAPER → STRUCTURE → VOLUME]
#v(3mm)
#text(size: 29pt, weight: "bold")[Engineering Model Diagrams]
#v(2mm)
#text(size: 11pt, fill: rgb("#617386"))[Evidence-led diagrams. Editable vectors. Genuine 3D geometry.]
#v(8mm)
#block(width: 100%, fill: white, radius: 3mm, inset: (x: 5mm,y: 6mm))[
  #text(size: 10pt, weight: "bold")[MULTI-SCALE ENCODER–DECODER]
  #h(1fr) #text(size: 8pt, fill: rgb("#758596"))[Architecture schematic]
  #v(4mm)
  #image("encoder-decoder.svg", width: 100%)
]
#v(5mm)
#grid(columns: (1fr, 1fr, 1fr), column-gutter: 5mm,
 [#text(size: 10pt, weight: "bold", fill: rgb("#52738D"))[01 · SEMANTIC STRUCTURE] #linebreak() #text(size: 8pt,fill: rgb("#617386"))[Modules, shapes and source evidence.]],
 [#text(size: 10pt, weight: "bold", fill: rgb("#52738D"))[02 · VOLUME DRAWING] #linebreak() #text(size: 8pt,fill: rgb("#617386"))[Feature scales, branches and skip paths.]],
 [#text(size: 10pt, weight: "bold", fill: rgb("#52738D"))[03 · EDITABLE OUTPUT] #linebreak() #text(size: 8pt,fill: rgb("#617386"))[Typst · PDF · SVG · PNG · GLB.]])
