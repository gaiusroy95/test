import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import {
  Bold, Italic, List, ListOrdered, Link as LinkIcon, Undo, Redo, Heading2,
} from "lucide-react";
import { useEffect } from "react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
  isFilled?: boolean;
}

export default function RichTextEditor({
  value, onChange, editable = true, placeholder = "Enter response…", isFilled,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-brand-accent underline" } }),
    ],
    content: value || "",
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none px-3 py-2 text-[13px] text-brand-navy min-h-[120px] focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  useEffect(() => { editor?.setEditable(editable); }, [editable, editor]);

  if (!editor) return null;

  const frameCls = `rounded-lg border transition-colors ${
    !editable ? "bg-slate-50 border-slate-100 cursor-not-allowed" :
    isFilled ? "border-emerald-200 bg-emerald-50/30 focus-within:border-brand-accent" :
    "border-slate-200 bg-white focus-within:border-brand-accent"
  }`;

  const BtnIcon = ({ Icon, active, onClick, title }: { Icon: any; active?: boolean; onClick: () => void; title: string }) => (
    <button type="button" onMouseDown={(e) => { e.preventDefault(); onClick(); }} title={title}
      disabled={!editable}
      className={`p-1 rounded hover:bg-slate-100 ${active ? "bg-slate-200 text-brand-accent" : "text-slate-500"} ${!editable ? "opacity-40 cursor-not-allowed" : ""}`}>
      <Icon size={13} />
    </button>
  );

  const promptLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev || "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className={frameCls}>
      {editable && (
        <div className="flex items-center gap-0.5 border-b border-slate-200 px-1.5 py-1">
          <BtnIcon Icon={Bold}       title="Bold"         active={editor.isActive("bold")}         onClick={() => editor.chain().focus().toggleBold().run()} />
          <BtnIcon Icon={Italic}     title="Italic"       active={editor.isActive("italic")}       onClick={() => editor.chain().focus().toggleItalic().run()} />
          <BtnIcon Icon={Heading2}   title="Heading"      active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
          <span className="w-px h-4 bg-slate-200 mx-1" />
          <BtnIcon Icon={List}        title="Bullet list"  active={editor.isActive("bulletList")}  onClick={() => editor.chain().focus().toggleBulletList().run()} />
          <BtnIcon Icon={ListOrdered} title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
          <BtnIcon Icon={LinkIcon}    title="Link"         active={editor.isActive("link")}         onClick={promptLink} />
          <span className="w-px h-4 bg-slate-200 mx-1" />
          <BtnIcon Icon={Undo} title="Undo" onClick={() => editor.chain().focus().undo().run()} />
          <BtnIcon Icon={Redo} title="Redo" onClick={() => editor.chain().focus().redo().run()} />
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
