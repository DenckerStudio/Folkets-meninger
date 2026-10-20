import type { CollectionConfig } from 'payload';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { postPublishHooks } from '@/hooks/postPublish';
import {
  contentFeedbackAfterChange,
  contentFeedbackAfterDelete,
  contentFeedbackBeforeOperation,
  contentFeedbackCaptureMainStatusBeforeChange,
} from '@/hooks/contentFeedbackWebhook';
import { preservePostOrigin } from '@/hooks/preservePostOrigin';
import { validatePostText } from '@/hooks/validatePostText';
import {
  canPublishField,
  editorsOnly,
  isEditor,
  postsCreateAccess,
  postsDeleteAccess,
  postsReadAccess,
  postsUpdateAccess,
  publishStatusFieldAccess,
} from '@/access/roles';
import { agentDraftGuard } from '@/hooks/agentDraftGuard';
import {
  enforceDraftDataBeforeChange,
  enforceDraftDataBeforeValidate,
  enforceDraftQueryForNonEditors,
} from '@/hooks/nonEditorDraftEnforcement';
import { setPublishedAtOnPublish } from '@/hooks/setPublishedAtOnPublish';

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', '_status', 'publishedAt', 'updatedAt'],
  },
  versions: {
    drafts: {
      autosave: true,
      schedulePublish: true,
    },
    maxPerDoc: 50,
  },
  access: {
    read: postsReadAccess,
    create: postsCreateAccess,
    update: postsUpdateAccess,
    delete: postsDeleteAccess,
    readVersions: editorsOnly,
    unlock: editorsOnly,
  },
  hooks: {
    beforeOperation: [enforceDraftQueryForNonEditors, contentFeedbackBeforeOperation],
    beforeValidate: [enforceDraftDataBeforeValidate, validatePostText],
    beforeChange: [
      contentFeedbackCaptureMainStatusBeforeChange,
      preservePostOrigin,
      agentDraftGuard,
      enforceDraftDataBeforeChange,
      setPublishedAtOnPublish,
    ],
    afterChange: [postPublishHooks, contentFeedbackAfterChange],
    afterDelete: [contentFeedbackAfterDelete],
  },
  fields: [
    {
      name: '_status',
      type: 'select',
      access: {
        create: publishStatusFieldAccess,
        update: publishStatusFieldAccess,
      },
      options: [],
    },
    { name: 'title', type: 'text', required: true, maxLength: 110 },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      name: 'excerpt',
      type: 'textarea',
      required: true,
      maxLength: 300,
    },
    {
      name: 'bodyMarkdown',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Markdown brukes på nettstedet og fra n8n-utkast.',
      },
    },
    {
      name: 'content',
      type: 'richText',
      editor: lexicalEditor(),
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      access: { create: canPublishField, update: canPublishField },
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      maxRows: 8,
    },
    {
      name: 'suggestedTags',
      type: 'array',
      admin: { description: 'Forslag fra n8n – godkjennes i redaksjon.' },
      fields: [{ name: 'value', type: 'text', required: true }],
    },
    {
      name: 'authors',
      type: 'relationship',
      relationTo: 'authors',
      hasMany: true,
      maxRows: 3,
    },
    {
      name: 'relatedSakIds',
      type: 'array',
      fields: [{ name: 'id', type: 'text', required: true }],
      maxRows: 8,
    },
    {
      name: 'relatedHoringIds',
      type: 'array',
      fields: [{ name: 'id', type: 'text', required: true }],
      maxRows: 8,
    },
    {
      name: 'sources',
      type: 'array',
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
      access: { create: canPublishField, update: canPublishField },
    },
    {
      name: 'updatedAtDisplay',
      type: 'date',
      admin: {
        description: 'Vises som «Oppdatert» og brukes i dateModified.',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'readingTimeMinutes',
      type: 'number',
      admin: { readOnly: true },
    },
    {
      name: 'origin',
      type: 'select',
      defaultValue: 'manual',
      access: {
        update: () => false,
      },
      options: [
        { label: 'Manuell', value: 'manual' },
        { label: 'n8n', value: 'n8n' },
      ],
    },
    {
      name: 'sourceEvent',
      type: 'text',
      unique: true,
      index: true,
      admin: { description: 'Idempotensnøkkel fra n8n (unik når satt).' },
    },
    {
      name: 'ai',
      type: 'group',
      fields: [
        { name: 'assisted', type: 'checkbox', defaultValue: false },
        { name: 'modelFamily', type: 'text' },
        { name: 'generatedAt', type: 'date' },
        { name: 'promptVersion', type: 'text' },
      ],
    },
    {
      name: 'review',
      type: 'group',
      fields: [
        {
          name: 'state',
          type: 'select',
          defaultValue: 'ny',
          options: [
            { label: 'Ny', value: 'ny' },
            { label: 'Til vurdering', value: 'til_vurdering' },
            { label: 'Godkjent', value: 'godkjent' },
            { label: 'Avvist', value: 'avvist' },
          ],
        },
        { name: 'note', type: 'textarea' },
      ],
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'metaTitle', type: 'text' },
        { name: 'metaDescription', type: 'textarea' },
        { name: 'ogImage', type: 'upload', relationTo: 'media' },
        { name: 'canonicalOverride', type: 'text' },
        { name: 'noindex', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'social',
      type: 'group',
      fields: [
        { name: 'blueskyText', type: 'textarea', maxLength: 300 },
        {
          name: 'socialPostedAt',
          type: 'date',
          access: { update: ({ req }) => isEditor(req.user as { role?: string }) },
        },
        {
          name: 'blueskyUri',
          type: 'text',
          access: { update: ({ req }) => isEditor(req.user as { role?: string }) },
        },
      ],
    },
  ],
};
