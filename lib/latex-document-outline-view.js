'use babel';

const Manager = require('./manager');
const Logger = require('./logger');
const fs = require('fs');

function addEventListenner(a) {
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

export default class LatexDocumentOutlineView {

  constructor(serializedState) {
    this.manager = new Manager(this);
    this.logger = new Logger(this);

    var main = this.manager.findMain();
    console.log(this.mainFile);

    // Create root element
    this.element = document.createElement('div');
    this.element.classList.add('latex-document-outline');

    // Create message element
    const message = document.createElement('div');
    message.textContent = 'The LatexDocumentOutline package is Alive! It\'s ALIVE!';
    message.classList.add('message');
    this.element.appendChild(message);

    this.subscriptions = atom.workspace.getCenter().observeActivePaneItem(item => {
    if (!atom.workspace.isTextEditor(item)) {
      message.innerText = 'Open a file to see important information about it.';
      return;
    }
    this.homeDir = require('path').dirname(this.mainFile);

    this.structure = this.manager.getStructure(this.mainFile);
    htmlString = ''
    if (this.structure.parts) {
      htmlString += `<ul>`;
      this.structure.parts.forEach(function(part) {
        htmlString += `<li class="part"><a class="open" data-line="${part.line}" data-file="${part.file}">${part.title}</a>`;

        if (part.chapters) {
          htmlString += `<ul>`;
          part.chapters.forEach(function(chapter) {
            htmlString += `<li class="chapter"><a class="open" data-line="${chapter.line}" data-file="${chapter.file}">${chapter.title}</a>`;

            if (chapter.sections) {
              htmlString += `<ul>`;
              chapter.sections.forEach(function(section) {
                htmlString += `<li class="section"><a class="open" data-line="${section.line}" data-file="${section.file}">${section.title}</a>`;

                if (section.subsections) {
                  htmlString += `<ul>`;
                  section.subsections.forEach(function(subsection) {
                    htmlString += `<li class="subsection"><a class="open" data-line="${subsection.line}" data-file="${subsection.file}">${subsection.title}</a>`;

                    if (subsection.subsubsections) {
                      htmlString += `<ul>`;
                      subsection.subsubsections.forEach(function(subsubsection) {
                        htmlString += `<li class="subsubsection"><a class="open" data-line="${subsubsection.line}" data-file="${subsubsection.file}">${subsubsection.title}</a>`;
                        htmlString += `</li>`;
                      });
                      htmlString += `</ul>`;
                    }

                    htmlString += `</li>`;
                  });
                  htmlString += `</ul>`;
                }

                htmlString += `</li>`;
              });
              htmlString += `</ul>`;
            }

            htmlString += `</li>`;
          });
          htmlString += `</ul>`;
        }

        htmlString += `</li>`;
      });
      htmlString += `</ul>`;
    }
    message.innerHTML = htmlString;
    links = message.getElementsByClassName("open")
    for (i=0; i<links.length; i++) {
      a = links[i];
      addEventListenner(a)
    }
  });
  }

  // Tear down any state and detach
  destroy() {
    this.element.remove();
    this.subscriptions.dispose();
  }

  getElement() {
    return this.element;
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
      deserializer: 'latex-document-outline/LatexDocumentOutlineView'
    };
  }
}
