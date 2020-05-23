'use babel';

const parser = require("./parser");

const Manager = require('./manager');
const Logger = require('./logger');

const fs = require('fs');
const path = require('path');

const indices = {'0':'parts', '1':'chapters', '2': 'sections', '3':'subsections', '4':'subsubsections'};

function chevron(subs, collapsed) {
  if (!subs) {
    return '';
  }
  if (subs && collapsed) {
    return 'chevron-right';
  }
  return 'chevron-down';
}

function makeTitle(content) {
  words = [];
  for (i in content) {
    if (content[i].content) {
      words.push(content[i].content);
    }
  }
  return words.join(" ");
}

function lineOf(text, substring){
  const lines = text.split("\n");
  for (const line in lines) {
    if (lines[line].includes(substring)){
        return line+1;
    }
  }

  return  0;
}

export default class LatexDocumentOutlineView {

  addFigure(title, type, text, root, file, line, part, chapter, section, subsection, subsubsection) {
    const fig = {title: title, type: type, file: path.join(root, file), line: lineOf(text, title)};
    console.log("Adding caption to "+[part, chapter, section, subsection, subsubsection].join(","));
    console.log(this.structure);
    if (chapter == -1) {
      console.log("chapter");
      this.structure.parts[part].figures.push(fig)
    }
    else if (section == -1) {
      console.log("section");
      this.structure.parts[part].chapters[chapter].figures.push(fig)
    }
    else if (subsection == -1) {
      console.log("subsection");
      this.structure.parts[part].chapters[chapter].sections[section].figures.push(fig)
    }
    else if (subsubsection == -1) {
      console.log("subsubsection");
      this.structure.parts[part].chapters[chapter].sections[section].subsections[subsection].figures.push(fig)
    }
    else {
      console.log("else");
      // this.structure.parts[part].chapters[chapter].sections[section].subsections[subsection].subsubsections[subsubsection].figures.push(fig)
    }
  }

  getStructure(text, root, file, content, part=-1, chapter=-1, section=-1, subsection=-1, subsubsection=-1) {
    var lastSaw = "part";
    console.log(this.structure);
    for (const i in content) {
      const item = content[i]
      if (item.type == "macro") {
        console.log("Seen a "+item.content);
        switch (item.content) {
          case "part":
            lastSaw = item.content;
            title = makeTitle(item.args[0].content);
            part++;
            chapter, section, subsection, subsubsection = -1;
            this.structure.parts.push({title: title, file: path.join(root, file), line: lineOf(text, title), chapters:[], figures:[], index: part})
            break;
          case "chapter":
            lastSaw = item.content;
            title = makeTitle(item.args[0].content);
            chapter++;
            section, subsection, subsubsection = -1;
            this.structure.parts[part].chapters.push({title: title, file: path.join(root, file), line: lineOf(text, title), sections:[], figures:[], index: chapter})
            break;
          case "section":
            lastSaw = item.content;
            title = makeTitle(item.args[0].content);
            section++;
            subsection, subsubsection = -1;
            this.structure.parts[part].chapters[chapter].sections.push({title: title, file: path.join(root, file), line: lineOf(text, title), subsections:[], figures:[], index: section})
            break;
          case "subsection":
            lastSaw = item.content;
            title = makeTitle(item.args[0].content);
            subsection++;
            subsubsection = -1;
            this.structure.parts[part].chapters[chapter].sections[section].subsections.push({title: title, file: path.join(root, file), line: lineOf(text, title), subsubsections:[], figures:[], index: subsection})
            break;
          case "subsubsection":
            lastSaw = item.content;
            title = makeTitle(item.args[0].content);
            subsubsection++;
            this.structure.parts[part].chapters[chapter].sections[section].subsections[subsection].subsubsections.push({title: title, file: path.join(root, file), line: lineOf(text, title), index: subsubsection})
            break;
          default:
            break;
        }
      }
      if (item.type == "environment") {
        if (["figure", "table"].includes(item.env[0].content)) {
          console.log(item.content[0].args[0].content);
          title = makeTitle(item.content[0].args[0].content);
          this.addFigure(title, item.env[0].content, text, root, file, lineOf(text, title), part, chapter, section, subsection, subsubsection);
        }
      }
    }
  }

  constructor(structure) {
    this.manager = new Manager(this);
    this.logger = new Logger(this);

    this.manager.findMain();
    this.homeDir = require('path').dirname(this.mainFile);

    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('latex-document-outline');

    // Create message element
    this.message = document.createElement('div');
    this.message.classList.add('message');
    this.element.appendChild(this.message);

    this.structure = {parts: []};

    // Read in the main file
    const text = fs.readFileSync(this.mainFile, 'utf8')
    const tokens = parser.parse(text);

    console.log(tokens);

    var doc = null;

    for (const token in tokens) {
      if (tokens[token].type == "environment" && tokens[token].env[0].content == "document") {
        doc = tokens[token];
      }
    }


    // TODO: Validate doc not null
    this.getStructure(text, this.homeDir, this.mainFile, doc.content);

    console.log(this.structure);
    this.updateView();
    // var self = this;
    //
    // atom.workspace.observeTextEditors(function(editor){
    //   editor.onDidSave(function(event) {
    //     self.structure = self.manager.getStructure(self.mainFile, {}, {part:0, chapter:0, section:0, subsection:0, subsubsection:0});
    //     self.updateView();
    //   });
    // });
  }

  updateView() {
    this.subscriptions = atom.workspace.getCenter().observeActivePaneItem(item => {
      if (!atom.workspace.isTextEditor(item)) {
        this.message.innerText = 'Open a latex file to see the document structure';
        return;
      }

      htmlString = ''
      if (this.structure.parts) {
        htmlString += `<ul class="collapse">`;
        console.log(this.structure.parts);

        this.structure.parts.forEach(function(part) {
          if (part) {
            if (part.title) {
              htmlString += `<li>
                              <div>
                                <i class='caret octicon ${chevron(part.chapters, part.collapsed)}' data-index="${part.index}"></i>
                                <a class="part open" data-line="${part.line}" data-file="${part.file}">
                                  ${part.title}
                                </a>
                              </div>`;
            }
            if (part.figures) {
              htmlString += `<ul class="figures ${part.collapsed? 'hidden' : ''}">`
              part.figures.forEach(function(figure){
                htmlString += `<li class="${figure.type}"><a class="open" data-line="${figure.line}" data-file=${part.file}>${figure.title}</a></li>`
              });
              htmlString += `</ul>`
            }

            if (part.chapters) {
              htmlString += `<ul class="collapse ${part.collapsed? 'hidden' : ''}">`;
              part.chapters.forEach(function(chapter) {
                if (chapter) {
                  if (chapter.title) {
                    htmlString += `<li>
                                    <div>
                                      <i class='caret octicon ${chevron(chapter.sections, chapter.collapsed)}' data-index="${chapter.index}"></i>
                                      <a class="chapter open" data-line="${chapter.line}" data-file="${chapter.file}">
                                        ${chapter.title}
                                      </a>
                                    </div>`;
                  }
                  if (chapter.figures) {
                    htmlString += `<ul class="figures ${chapter.collapsed? 'hidden' : ''}">`
                    chapter.figures.forEach(function(figure){
                      htmlString += `<li class="${figure.type}"><a class="open" data-line="${figure.line}" data-file=${chapter.file}>${figure.title}</a></li>`
                    });
                    htmlString += `</ul>`
                  }

                  if (chapter.sections) {
                    htmlString += `<ul class="collapse ${chapter.collapsed? 'hidden' : ''}">`;
                    chapter.sections.forEach(function(section) {
                      if (section) {
                        if (section.title) {
                          htmlString += `<li>
                                          <div>
                                            <i class='caret octicon ${chevron(section.subsections, section.collapsed)}' data-index="${section.index}"></i>
                                            <a class="section open" data-line="${section.line}" data-file="${section.file}">
                                              ${section.title}
                                            </a>
                                          </div>`;
                        }
                        if (section.figures) {
                          htmlString += `<ul class="figures ${section.collapsed? 'hidden' : ''}">`
                          section.figures.forEach(function(figure){
                            htmlString += `<li class="${figure.type}"><a class="open" data-line="${figure.line}" data-file=${section.file}>${figure.title}</a></li>`
                          });
                          htmlString += `</ul>`
                        }

                        if (section.subsections) {
                          htmlString += `<ul class="collapse ${section.collapsed? 'hidden' : ''}">`;
                          section.subsections.forEach(function(subsection) {
                            if (subsection) {
                              if (subsection.title) {
                                htmlString += `<li>
                                                <div>
                                                  <i class='caret octicon ${chevron(subsection.subsubsections, subsection.collapsed)}' data-index="${subsection.index}"></i>
                                                  <a class="subsection open" data-line="${subsection.line}" data-file="${subsection.file}">
                                                    ${subsection.title}
                                                  </a>
                                                </div>`;
                              }
                              if (subsection.figures) {
                                htmlString += `<ul class="figures ${subsection.collapsed? 'hidden' : ''}">`
                                subsection.figures.forEach(function(figure){
                                  htmlString += `<li class="${figure.type}"><a class="open" data-line="${figure.line}" data-file=${subsection.file}>${figure.title}</a></li>`
                                });
                                htmlString += `</ul>`
                              }

                              if (subsection.subsubsections) {
                                htmlString += `<ul class="collapse ${subsection.collapsed? 'hidden' : ''}">`;
                                subsection.subsubsections.forEach(function(subsubsection) {
                                  if (subsubsection) {
                                    if (subsubsection.title) {
                                      htmlString += `<li>
                                                      <div>
                                                        <i class='caret octicon' data-index="${subsubsection.index}"></i>
                                                        <a class="subsubsection open" data-line="${subsubsection.line}" data-file="${subsubsection.file}">
                                                          ${subsubsection.title}
                                                        </a>
                                                      </div>
                                                    </li>`;
                                    }
                                    if (subsubsection.figures) {
                                      htmlString += `<ul class="figures ${subsubsection.collapsed? 'hidden' : ''}">`
                                      subsubsection.figures.forEach(function(figure){
                                        htmlString += `<li class="${figure.type}"><a class="open" data-line="${figure.line}" data-file=${subsubsection.file}>${figure.title}</a></li>`
                                      });
                                      htmlString += `</ul>`
                                    }
                                  }
                                });
                                htmlString += `</ul>`;
                              }
                              if (subsection.title) {
                                htmlString += `</li>`;
                              }
                            }
                          });
                          htmlString += `</ul>`;
                        }
                        if (section.title) {
                          htmlString += `</li>`;
                        }
                      }
                    });
                    htmlString += `</ul>`;
                  }
                  if (chapter.title) {
                    htmlString += `</li>`;
                  }
                }
              });
              htmlString += `</ul>`;
            }
            if (part.title) {
              htmlString += `</li>`;
            }
          }
        });
        htmlString += `</ul>`;
      }
      this.message.innerHTML = htmlString;
      links = this.message.getElementsByClassName("open");
      for (i=0; i<links.length; i++) {
        a = links[i];
        this.addEventListenner(a)
      }

      carets = this.message.getElementsByClassName('caret');
      for (i=0; i< carets.length; i++) {
        caret = carets[i];
        caret.addEventListener('click', this.collapse.bind(this, caret));
      }
    });
  }

  collapse(node, e) {
    index = node.dataset.index;
    s = index.split("-");
    obj = this.structure;
    for (i in s) {
      obj = obj[indices[i]][s[i]];
    }
    collapse = node.parentNode.nextSibling.nextSibling;
    figures = node.parentNode.nextSibling;
    if (node.classList.contains('chevron-down')) {
      node.classList.remove("chevron-down");
      node.classList.add("chevron-right");
      collapse.classList.add('hidden');
      figures.classList.add('hidden');
      obj.collapsed = true;
    }
    else if (node.classList.contains('chevron-right')) {
      node.classList.remove("chevron-right");
      node.classList.add("chevron-down");
      collapse.classList.remove('hidden');
      figures.classList.remove('hidden');
      obj.collapsed = false;
    }
  }

  // Tear down any state and detach
  destroy() {
    this.element.remove();
    this.subscriptions.dispose();
  }

  getElement() {
    return this.element;
  }

  addEventListenner(a) {
    a.addEventListener('click', (ev) => {
      filename = a.dataset.file;
      line = a.dataset.line || 1;
      const exists = fs.existsSync(filename);
      if (exists) {
        atom.workspace.open(filename, {initialLine: line-1});
      } else {
        atom.beep();
      }
    });
  }

  getTitle() {
    // Used by Atom for tab text
    return 'Document Outline';
  }

  getURI() {
    // Used by Atom to identify the view when toggling.
    return 'atom://latex-document-outline';
  }

  getDefaultLocation() {
    // This location will be used if the user hasn't overridden it by dragging the item elsewhere.
    // Valid values are "left", "right", "bottom", and "center" (the default).
    return 'right';
  }

  getAllowedLocations() {
    // The locations into which the item can be moved.
    return ['left', 'right', 'bottom'];
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {
    return {
      deserializer: 'latex-document-outline/LatexDocumentOutlineView',
      structure: JSON.stringify(this.structure),
    };
  }
}
