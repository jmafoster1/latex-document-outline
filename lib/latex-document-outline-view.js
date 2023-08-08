'use babel';

const Manager = require('./manager');
const Logger = require('./logger');
const fs = require('fs');
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

export default class LatexDocumentOutlineView {

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

    this.structure = this.manager.getStructure(this.mainFile, (structure || {}), {part:0, chapter:0, section:0, subsection:0, subsubsection:0});
    this.updateView();
    let self = this;

    atom.workspace.observeTextEditors(function(editor){
      editor.onDidSave(function(event) {
        self.structure = self.manager.getStructure(self.mainFile, {}, {part:0, chapter:0, section:0, subsection:0, subsubsection:0});
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

      let htmlString = '';
      if (this.structure.parts) {
        htmlString += `<ul class="collapse">`;
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
      const links = this.message.getElementsByClassName("open");
      for (let i=0; i<links.length; i++) {
        this.addEventListenner(links[i])
      }

      const carets = this.message.getElementsByClassName('caret');
      for (let i=0; i< carets.length; i++) {
        let caret = carets[i];
        caret.addEventListener('click', this.collapse.bind(this, caret));
      }
    });
  }

  collapse(node, e) {
    const index = node.dataset.index;
    const s = index.split("-");
    let obj = this.structure;
    for (let i in s) {
      obj = obj[indices[i]][s[i]];
    }
    const collapse = node.parentNode.nextSibling.nextSibling;
    const figures = node.parentNode.nextSibling;
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
      const filename = a.dataset.file;
      const line = a.dataset.line || 1;
      if (fs.existsSync(filename)) {
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
