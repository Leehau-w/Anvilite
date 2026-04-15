import { Node, mergeAttributes } from '@tiptap/core'

export const SOPLinkNode = Node.create({
  name: 'sopLink',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      sopId: { default: null },
      sopTitle: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-sop-link]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-sop-link': '',
        style: 'color: var(--color-accent); cursor: pointer; text-decoration: underline;',
      }),
      `📋 ${HTMLAttributes.sopTitle}`,
    ]
  },
})
