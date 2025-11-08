import React, { useEffect } from 'react'
import { Button, Divider, Tooltip } from '@douyinfe/semi-ui'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import './style.scss'

export interface RichNoteEditorProps {
  value: string
  onChange: (text: string, html: string, markdown: string) => void
  disabled?: boolean
}

export default function RichNoteEditor({ value, onChange, disabled }: RichNoteEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON() as any
      const md = jsonToMarkdown(json)
      onChange(editor.getText(), editor.getHTML(), md)
    },
  })

  useEffect(() => {
    if (!editor) return
    const currentText = editor.getText()
    if (currentText !== value) {
      editor.commands.setContent(value || '')
    }
  }, [value, editor])

  return (
    <div className="rich-note">
      <div className="rich-note__toolbar">
        <Tooltip content="Bold"><Button size="small" type="tertiary" onClick={() => editor?.chain().focus().toggleBold().run()}>
          <span className="rich-note__btn">B</span>
        </Button></Tooltip>
        <Tooltip content="Italic"><Button size="small" type="tertiary" onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <span className="rich-note__btn">I</span>
        </Button></Tooltip>
        <Tooltip content="Strike"><Button size="small" type="tertiary" onClick={() => editor?.chain().focus().toggleStrike().run()}>
          <span className="rich-note__btn">S</span>
        </Button></Tooltip>
        <Tooltip content="Heading"><Button size="small" type="tertiary" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
          <span className="rich-note__btn">H2</span>
        </Button></Tooltip>
        <Tooltip content="Bullet List"><Button size="small" type="tertiary" onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <span className="rich-note__btn">•</span>
        </Button></Tooltip>
        <Tooltip content="Ordered List"><Button size="small" type="tertiary" onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <span className="rich-note__btn">1.</span>
        </Button></Tooltip>
        <Tooltip content="Quote"><Button size="small" type="tertiary" onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
          <span className="rich-note__btn">❝</span>
        </Button></Tooltip>
        <Tooltip content="Code"><Button size="small" type="tertiary" onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
          <span className="rich-note__btn">{'</>'}</span>
        </Button></Tooltip>
      </div>
      <div className="rich-note__editor">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

function jsonToMarkdown(doc: any): string {
  function wrapMarks(text: string, marks?: any[]): string {
    if (!marks || !marks.length) return text
    let t = text
    const has = (type: string) => marks.some(m => m.type === type)
    if (has('code')) t = '`' + t + '`'
    if (has('bold')) t = '**' + t + '**'
    if (has('italic')) t = '_' + t + '_'
    if (has('strike')) t = '~~' + t + '~~'
    return t
  }
  function renderNode(node: any): string {
    switch (node.type) {
      case 'text':
        return wrapMarks(node.text || '', node.marks)
      case 'paragraph':
        return (node.content?.map(renderNode).join('') || '') + '\n'
      case 'heading': {
        const level = node.attrs?.level || 1
        const prefix = '#'.repeat(Math.max(1, Math.min(6, level))) + ' '
        return prefix + (node.content?.map(renderNode).join('') || '') + '\n'
      }
      case 'bulletList': {
        const items = (node.content || []).map((li: any) => {
          const inner = (li.content || []).map(renderNode).join('').trimEnd()
          return '- ' + inner
        })
        return items.join('\n') + '\n'
      }
      case 'orderedList': {
        const items = (node.content || []).map((li: any, idx: number) => {
          const inner = (li.content || []).map(renderNode).join('').trimEnd()
          return `${idx + 1}. ` + inner
        })
        return items.join('\n') + '\n'
      }
      case 'blockquote': {
        const inner = (node.content || []).map(renderNode).join('').trimEnd().split('\n')
        return inner.map((line: string) => (line ? '> ' + line : '')).join('\n') + '\n'
      }
      case 'codeBlock': {
        const text = (node.content || []).map(renderNode).join('')
        return '```\n' + text.replace(/\n*$/, '') + '\n```\n'
      }
      case 'hardBreak':
        return '\n'
      case 'listItem':
        return (node.content?.map(renderNode).join('') || '')
      default:
        return (node.content?.map(renderNode).join('') || '')
    }
  }
  return (doc.content || []).map(renderNode).join('')
}