'use babel';

import LatexDocumentOutlineView from './latex-document-outline-view';
import { CompositeDisposable, Disposable } from 'atom';

export default {
  subscriptions: null,

  activate(state) {
    this.subscriptions = new CompositeDisposable(
      // Add an opener for our view.
      atom.workspace.addOpener(uri => {
        if (uri === 'atom://latex-document-outline') {
          return new LatexDocumentOutlineView();
        }
      }),

      // Register command that toggles this view
      atom.commands.add('atom-workspace', {
        'latex-document-outline:toggle': () => this.toggle()
      }),

      // Destroy any LatexDocumentOutlineViews when the package is deactivated.
      new Disposable(() => {
        atom.workspace.getPaneItems().forEach(item => {
          if (item instanceof LatexDocumentOutlineView) {
            item.destroy();
          }
        });
      })
    );
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  toggle() {
    atom.workspace.toggle('atom://latex-document-outline');
  },

  deserializeLatexDocumentOutlineView(serialized) {
    return new LatexDocumentOutlineView();
  }
};
