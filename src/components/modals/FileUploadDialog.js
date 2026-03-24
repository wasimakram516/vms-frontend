"use client";
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  CircularProgress,
} from "@mui/material";
import slugify from "@/utils/slugify";
import ICONS from "@/utils/iconUtil";
import DialogHeader from "@/components/modals/DialogHeader";

export default function FileUploadDialog({
  open,
  onClose,
  onSubmit,
  editingFile,
  businessSlug,
}) {
  const translations = {
    en: {
      uploadNewFile: "Upload New File",
      updateFile: "Update File",
      title: "Title",
      slug: "Slug",
      cancel: "Cancel",
      upload: "Upload",
      update: "Update",
      uploading: "Uploading...",
      updating: "Updating...",
    },
  };
  const t = translations.en;
  const dir = "ltr";
  const align = "left";

  const [title, setTitle] = useState(editingFile?.title || "");
  const [slug, setSlug] = useState(editingFile?.slug || "");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (!editingFile) {
      setSlug(slugify(newTitle));
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("title", title);
      formData.append("slug", slug);
      formData.append("businessSlug", businessSlug);
      if (file) formData.append("file", file);

      if (editingFile) {
        await onSubmit(formData, editingFile._id);
      } else {
        await onSubmit(formData);
      }

      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={!loading ? onClose : undefined}
      fullWidth
      dir={dir}
    >
      <DialogHeader
        title={editingFile ? t.updateFile : t.uploadNewFile}
        onClose={!loading ? onClose : undefined}
        align={align}
      />
      <DialogContent sx={{ direction: dir, textAlign: align }}>
        <Stack spacing={2} mt={1}>
          <TextField
            label={t.title}
            value={title}
            onChange={handleTitleChange}
            fullWidth
            disabled={loading}
            inputProps={{ style: { textAlign: align } }}
          />
          <TextField
            label={t.slug}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            fullWidth
            disabled={loading}
            inputProps={{ style: { textAlign: align } }}
          />
          <input
            type="file"
            accept="*/*"
            onChange={(e) => setFile(e.target.files[0])}
            style={{ marginTop: 10 }}
            disabled={loading}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ direction: dir }}>
        <Button
          onClick={onClose}
          disabled={loading}
          startIcon={<ICONS.cancel />}
        >
          {t.cancel}
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !title || (!editingFile && !file)}
          startIcon={
            loading ? (
              <CircularProgress size={18} color="inherit" />
            ) : editingFile ? (
              <ICONS.save />
            ) : (
              <ICONS.upload />
            )
          }
        >
          {loading
            ? editingFile
              ? t.updating
              : t.uploading
            : editingFile
              ? t.update
              : t.upload}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
