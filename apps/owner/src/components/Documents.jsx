/**
 * Documents on a shipment (seller bill, RR / BL, weighment slip…): pick files with a type each,
 * upload them, list / view / remove. Owner only — the API refuses everyone else.
 */
import { File06, Image01, LinkExternal01, Paperclip, Plus, Trash01, Upload01, XClose } from '@untitledui/icons';
import { useState } from 'react';
import { DOCUMENT_KIND_LABELS, DOCUMENT_KINDS, DOCUMENT_MAX_MB, DOCUMENT_TYPES, formatDateTime } from '@feather/shared';
import { Button, ButtonUtility, Card, CardHeader, ConfirmDialog, EmptyState, Loading, Modal, SelectField, StatusBadge, useApi, useToast } from '@feather/ui';
import { FileTrigger } from '@uui/components/base/file-upload-trigger/file-upload-trigger';
import { useAction, useGet } from '@/lib/hooks.js';

const KIND_OPTIONS = Object.entries(DOCUMENT_KIND_LABELS).map(([value, label]) => ({ value, label }));

export const formatSize = (bytes = 0) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** A sensible first guess of the type from the file name; the owner can change it. */
const guessKind = (name) => {
  if (/\b(rr|bl|lading|railway)\b/i.test(name)) return DOCUMENT_KINDS.SHIPMENT_PAPER;
  if (/weigh|slip/i.test(name)) return DOCUMENT_KINDS.WEIGHMENT;
  return DOCUMENT_KINDS.SELLER_BILL;
};

/**
 * Choose files to attach, each with a type. Files that are not PDF / picture or are over the limit
 * are refused right away with a message.
 * @param {{ files: {id:string, file: File, kind: string}[], onChange: (files) => void }} props
 */
export function DocumentPicker({ files, onChange }) {
  const [refused, setRefused] = useState([]);
  const add = (list) => {
    const picked = [...(list ?? [])];
    const ok = picked.filter((f) => DOCUMENT_TYPES.includes(f.type) && f.size <= DOCUMENT_MAX_MB * 1024 * 1024);
    setRefused(picked.filter((f) => !ok.includes(f)).map((f) => f.name));
    onChange([...files, ...ok.map((file) => ({ id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`, file, kind: guessKind(file.name) }))]);
  };
  const setKind = (id, kind) => onChange(files.map((f) => (f.id === id ? { ...f, kind } : f)));
  const remove = (id) => onChange(files.filter((f) => f.id !== id));

  return (
    <div className="flex flex-col gap-3">
      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((f) => {
            const Icon = f.file.type === 'application/pdf' ? File06 : Image01;
            return (
              <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-lg p-2 ring-1 ring-secondary">
                <Icon className="size-5 shrink-0 text-fg-quaternary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-primary">{f.file.name}</p>
                  <p className="text-xs text-tertiary">{formatSize(f.file.size)}</p>
                </div>
                <SelectField size="sm" className="w-48" value={f.kind} onChange={(k) => setKind(f.id, k)} options={KIND_OPTIONS} />
                <ButtonUtility size="xs" color="tertiary" icon={XClose} tooltip="Don't attach" onPress={() => remove(f.id)} />
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <FileTrigger allowsMultiple acceptedFileTypes={[...DOCUMENT_TYPES]} onSelect={add}>
          <Button size="sm" color="secondary" iconLeading={Paperclip}>
            {files.length ? 'Attach more' : 'Attach files'}
          </Button>
        </FileTrigger>
        <span className="text-xs text-tertiary">PDF, JPG, PNG or WEBP · up to {DOCUMENT_MAX_MB} MB each</span>
      </div>
      {refused.length > 0 && (
        <p className="text-sm text-error-primary">
          Not attached (not a PDF / picture, or over {DOCUMENT_MAX_MB} MB): {refused.join(', ')}
        </p>
      )}
    </div>
  );
}

/** Upload picked files to a shipment one by one. Returns the names that failed. */
export async function uploadDocuments(api, consignmentId, files) {
  const failed = [];
  for (const f of files) {
    const form = new FormData();
    form.append('kind', f.kind);
    form.append('file', f.file, f.file.name);
    try {
      await api.upload(`/consignments/${consignmentId}/documents`, form);
    } catch {
      failed.push(f.file.name);
    }
  }
  return failed;
}

/** "Documents" card on the shipment page: list, view, add, remove. */
export function DocumentsCard({ consignmentId }) {
  const { data, isLoading } = useGet(`/consignments/${consignmentId}/documents`);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const remove = useAction((api, { id, reason }) => api.post(`/consignments/${consignmentId}/documents/${id}/remove`, { reason }), {
    success: 'Document removed',
    invalidate: [`/consignments/${consignmentId}/documents`],
    onSuccess: () => setRemoving(null),
  });
  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader
        icon={Paperclip}
        title="Documents"
        subtitle="Seller bill, RR / Bill of Lading and other papers. Only you can see them."
        actions={
          <Button size="sm" color="secondary" iconLeading={Plus} onPress={() => setAdding(true)}>
            Add
          </Button>
        }
      />
      {isLoading ? (
        <Loading />
      ) : !items.length ? (
        <EmptyState icon={Paperclip} title="No documents yet">
          Attach the seller&apos;s bill or the RR / Bill of Lading.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-secondary">
          {items.map((d) => {
            const Icon = d.contentType === 'application/pdf' ? File06 : Image01;
            return (
              <li key={d._id} className="flex items-center gap-3 px-5 py-3 md:px-6">
                <Icon className="size-5 shrink-0 text-fg-quaternary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <a href={d.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium text-primary hover:underline">
                    {d.name}
                  </a>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-tertiary">
                    <StatusBadge tone="neutral">{DOCUMENT_KIND_LABELS[d.kind]}</StatusBadge>
                    {formatSize(d.size)} · {d.uploadedBy?.name ?? '—'} · {formatDateTime(d.createdAt)}
                  </p>
                </div>
                {/* Plain link: the file is outside the app (signed storage link), so it must not go through the app router. */}
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${d.name}`}
                  title="Open"
                  className="rounded-md p-1.5 text-fg-quaternary outline-focus-ring hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2"
                >
                  <LinkExternal01 className="size-4" aria-hidden />
                </a>
                <ButtonUtility size="xs" color="tertiary" icon={Trash01} tooltip="Remove" onPress={() => setRemoving(d)} />
              </li>
            );
          })}
        </ul>
      )}
      {adding && <AddDocumentsDialog consignmentId={consignmentId} onClose={() => setAdding(false)} />}
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        loading={remove.isPending}
        needReason
        variant="danger"
        title={`Remove ${removing?.name ?? 'document'}?`}
        message="It is taken off this shipment. The file and your reason are kept in History."
        confirmLabel="Remove"
        onConfirm={(reason) => remove.mutate({ id: removing._id, reason })}
      />
    </Card>
  );
}

function AddDocumentsDialog({ consignmentId, onClose }) {
  const api = useApi();
  const toast = useToast();
  const [files, setFiles] = useState([]);
  const upload = useAction(() => uploadDocuments(api, consignmentId, files), {
    invalidate: [`/consignments/${consignmentId}/documents`],
    onSuccess: (failed) => {
      const done = files.length - failed.length;
      if (done) toast(`${done} document${done === 1 ? '' : 's'} attached`);
      if (!failed.length) return onClose();
      // Keep only the ones that failed, so "Upload" again does not attach the others twice.
      setFiles((fs) => fs.filter((f) => failed.includes(f.file.name)));
      toast(`Could not attach: ${failed.join(', ')}. Try again.`, 'bad');
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      icon={Upload01}
      title="Add documents"
      description="Choose the files and what each one is."
      footer={
        <>
          <Button color="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button iconLeading={Upload01} isDisabled={!files.length} isLoading={upload.isPending} onPress={() => upload.mutate()}>
            Upload
          </Button>
        </>
      }
    >
      <DocumentPicker files={files} onChange={setFiles} />
    </Modal>
  );
}
