import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type EasyMDE from 'easymde';
import {
  Bold,
  Columns2,
  Eye,
  Heading,
  HelpCircle,
  ImageUp,
  Italic,
  Link,
  List,
  ListOrdered,
  Maximize,
  Quote,
  type LucideIcon,
} from 'lucide-react';

// One per button in getEditorOptions' toolbar.
const TOOLBAR_ICONS: Record<string, LucideIcon> = {
  bold: Bold,
  italic: Italic,
  heading: Heading,
  quote: Quote,
  'unordered-list': List,
  'ordered-list': ListOrdered,
  link: Link,
  'upload-image': ImageUp,
  preview: Eye,
  'side-by-side': Columns2,
  fullscreen: Maximize,
  guide: HelpCircle,
};

/**
 * EasyMDE draws its toolbar with Font Awesome glyphs, which don't match the
 * Lucide icons used everywhere else. Its buttons keep their own behaviour;
 * this only renders a Lucide icon inside each one.
 */
export const EditorToolbarIcons = ({ editor }: { editor: EasyMDE | null }) => {
  // toolbarElements isn't in EasyMDE's typings, but it's how EasyMDE itself
  // finds its buttons again (e.g. to mark side-by-side active).
  const buttons = (editor as unknown as { toolbarElements?: Record<string, HTMLElement> } | null)?.toolbarElements;

  // The buttons only carry a title; give screen readers the same name.
  useEffect(() => {
    for (const button of Object.values(buttons ?? {})) {
      if (button.title) button.setAttribute('aria-label', button.title);
    }
  }, [buttons]);

  if (!buttons) return null;

  return (
    <>
      {Object.entries(TOOLBAR_ICONS).map(([name, Icon]) => {
        const button = buttons[name];
        if (!button) return null;
        return createPortal(<Icon size={16} strokeWidth={2} aria-hidden="true" />, button, name);
      })}
    </>
  );
};
