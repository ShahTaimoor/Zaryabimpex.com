import React, { forwardRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

/**
 * Rich text editor — default export for React.lazy so react-quill loads only when the notes editor is shown.
 */
const NotesQuillEditor = forwardRef((props, ref) => (
  <ReactQuill ref={ref} {...props} />
));

NotesQuillEditor.displayName = 'NotesQuillEditor';

export default NotesQuillEditor;
