'use babel';

const parser = require("./parser");

const Manager = require('./manager');
const Logger = require('./logger');

const fs = require('fs');
const path = require('path');
var _ = require('lodash');

const indices = {
  '0': 'parts',
  '1': 'chapters',
  '2': 'sections',
  '3': 'subsections',
  '4': 'subsubsections',
  '5': 'figures'
};

const supportedFigs = ["figure", "table", "algorithm"];
const supportedDivs = ["part", "chapter", "section", "subsection", "subsubsection"];
const hierachy = {
  'part': 0,
  'chapter': 1,
  'section': 2,
  'subsection': 3,
  'subsubsection': 4,
  'figure': 5,
  'table': 5,
  'algorithm': 5
};

function chevron(subs, collapsed) {
  if (!subs) {
    return '';
  }
  if (subs && collapsed) {
    return 'chevron-right';
  }
  return 'chevron-down';
}

function split(lst, f) {
  const fst = _.takeWhile(lst, x => f(x))
  return {fst: fst, snd: lst.slice(fst.length)};
}

function groupBy(lst, f) {
  if (lst.length == 0) {
    return [];
  }
  const spl = split(lst.slice(1), x => f(lst[0], x));

  return [[lst[0]].concat(spl.fst)].concat(groupBy(spl.snd, f));
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

function lineOf(text, substring) {
  const lines = text.split("\n");
  for (const line in lines) {
    if (lines[line].includes(substring)) {
      return line + 1;
    }
  }
  return 0;
}

function newObj(title, line, file, type, inx) {
  return {
    title: title,
    file: file,
    line: line,
    type: type,
    index: inx
  };
}

function makeIndex(ii) {
  var inx = [];
  for (i in ii) {
    inx.push(indices[i]);
    inx.push(ii[i]);
  }
  return inx;
}

function insertInto(struct, part) {
  var i;
  for (i=0; i<part.index.length - 1; i++) {
    if (!struct[part.index[i]]) {
      struct[part.index[i]] = []
    }
    struct = struct[part.index[i]]
  }
  struct[part.index[i]] = part
}

export default class LatexDocumentOutlineView {

  getStructure(text, root, file, content, part = 0, chapter = 0, section = 0, subsection = 0, subsubsection = 0, fig=0) {
    var lastSaw = "part";
    for (const i in content) {
      const item = content[i]
      if (item.type == "macro" && supportedDivs.includes(item.content)) {
        switch (item.content) {
          case "part":
            part++;
            chapter, section, subsection, subsubsection, fig = 0;
            break;
          case "chapter":
            chapter++;
            section, subsection, subsubsection, fig = 0;
            break;
          case "section":
            section++;
            subsection, subsubsection, fig = 0;
            break;
          case "subsection":
            subsection++;
            subsubsection, fig = 0;
            break;
          case "subsubsection":
            subsubsection++;
            fig = 0;
            break;
          default:
            break;
        }
        lastSaw = item.content;
        title = makeTitle(item.args[0].content);
        this.structure.push(newObj(title, lineOf(text, title), path.join(root, file), lastSaw, makeIndex([part, chapter, section, subsection, subsubsection].slice(0, hierachy[lastSaw]+1))));
      }
      if (item.type == "environment") {
        if (supportedFigs.includes(item.env[0].content)) {
          fig++;
          title = makeTitle(item.content[0].args[0].content);
          this.structure.push(newObj(title, lineOf(text, title), path.join(root, file), item.env[0].content, makeIndex([part, chapter, section, subsection, subsubsection].slice(0, hierachy[lastSaw]+1)).concat(["figures", fig])))
        }
      }
    }
  }

  updateStructure() {
    this.structure = [];

    // Read in the main file
    const text = fs.readFileSync(this.mainFile, 'utf8')
    const tokens = parser.parse(text);

    var doc = null;
    for (const token in tokens) {
      if (tokens[token].type == "environment" && tokens[token].env[0].content == "document") {
        doc = tokens[token];
      }
    }

    // TODO: Validate doc not null
    this.getStructure(text, this.homeDir, this.mainFile, doc.content);
  }

  objStructure() {
    var struct = {};
    for (i in this.structure) {
      const part = this.structure[i];
      insertInto(struct, part);
    }
    this.structure = struct;
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

    this.updateStructure();

    this.objStructure();

    this.updateView();
    var self = this;

    atom.workspace.observeTextEditors(function(editor) {
      editor.onDidSave(function(event) {
        self.updateStructure();
        self.objStructure();
        self.updateView();
      });
    });
  }

  updateView() {
    this.subscriptions = atom.workspace.getCenter().observeActivePaneItem(item => {
      if (!atom.workspace.isTextEditor(item)) {
        this.message.innerText = 'Open a latex file to see the document structure';
        return;
      }

      htmlString = "";
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
      for (i = 0; i < links.length; i++) {
        a = links[i];
        this.addEventListenner(a)
      }

      carets = this.message.getElementsByClassName('caret');
      for (i = 0; i < carets.length; i++) {
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
    } else if (node.classList.contains('chevron-right')) {
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
        atom.workspace.open(filename, {
          initialLine: line - 1
        });
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
