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

    var main = this.manager.findMain();
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
        this.structure.parts.forEach(function(part) {
          if (part) {
            htmlString += `<li class="part">
                            <i class='caret octicon ${chevron(part.chapters, part.collapsed)}' data-index="${part.index}"></i>
                            <a class="open" data-line="${part.line}" data-file="${part.file}">
                              ${part.title}
                            </a>`;

            if (part.chapters) {
              htmlString += `<ul class="collapse ${part.collapsed? 'hidden' : ''}">`;
              part.chapters.forEach(function(chapter) {
                if (chapter) {
                  htmlString += `<li class="chapter">
                                  <i class='caret octicon ${chevron(chapter.sections, chapter.collapsed)}' data-index="${chapter.index}"></i>
                                  <a class="open" data-line="${chapter.line}" data-file="${chapter.file}">
                                    ${chapter.title}
                                  </a>`;

                  if (chapter.sections) {
                    htmlString += `<ul class="collapse ${chapter.collapsed? 'hidden' : ''}">`;
                    chapter.sections.forEach(function(section) {
                      if (section) {
                        htmlString += `<li class="section">
                                        <i class='caret octicon ${chevron(section.subsections, section.collapsed)}' data-index="${section.index}"></i>
                                        <a class="open" data-line="${section.line}" data-file="${section.file}">
                                          ${section.title}
                                        </a>`;

                        if (section.subsections) {
                          htmlString += `<ul class="collapse ${section.collapsed? 'hidden' : ''}">`;
                          section.subsections.forEach(function(subsection) {
                            if (subsection) {
                              htmlString += `<li class="subsection">
                                              <i class='caret octicon ${chevron(subsection.subsubsections, subsection.collapsed)}' data-index="${subsection.index}"></i>
                                              <a class="open" data-line="${subsection.line}" data-file="${subsection.file}">
                                                ${subsection.title}
                                              </a>`;

                              if (subsection.subsubsections) {
                                htmlString += `<ul class="collapse ${subsection.collapsed? 'hidden' : ''}">`;
                                subsection.subsubsections.forEach(function(subsubsection) {
                                  if (subsubsection) {
                                    htmlString += `<li class="subsubsection">
                                                    <i class='caret octicon' data-index="${subsubsection.index}"></i>
                                                    <a class="open" data-line="${subsubsection.line}" data-file="${subsubsection.file}">
                                                      ${subsubsection.title}
                                                    </a>
                                                  </li>`;
                                  }
                                });
                                htmlString += `</ul>`;
                              }
                              htmlString += `</li>`;
                            }
                          });
                          htmlString += `</ul>`;
                        }
                        htmlString += `</li>`;

                      }
                    });
                    htmlString += `</ul>`;
                  }
                  htmlString += `</li>`;
                }
              });
              htmlString += `</ul>`;
            }
            htmlString += `</li>`;
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
        caret.addEventListener('click', this.collapse.bind(null, caret));
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
    collapse = node.nextSibling.nextSibling.nextSibling;
    if (node.classList.contains('chevron-down')) {
      node.classList.remove("chevron-down");
      node.classList.add("chevron-right");
      collapse.classList.add('hidden');
      obj.collapsed = true;
    }
    else if (node.classList.contains('chevron-right')) {
      node.classList.remove("chevron-right");
      node.classList.add("chevron-down");
      collapse.classList.remove('hidden');
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
