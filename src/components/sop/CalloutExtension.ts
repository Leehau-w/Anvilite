import { Node, mergeAttributes } from '@tiptap/core'

export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      variant: {
        default: 'info',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-variant') || 'info',
        renderHTML: (attrs: Record<string, string>) => ({ 'data-variant': attrs.variant }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-callout': '' }), 0]
  },
})
