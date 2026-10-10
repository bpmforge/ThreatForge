"use client";

import { useState } from "react";
import {
  useUserStory,
  useCreateUserStory,
  useUpdateUserStory,
} from "./useUserStories";
import type { UserStoryStatus, CreateUserStoryRequest } from "../types";

export function useUserStoryForm(
  projectId: string,
  storyId: string | undefined,
  onClose: () => void,
  onSaved?: (storyId: string) => void,
) {
  const isEditing = !!storyId;
  const { data: existingStory, isLoading } = useUserStory(projectId, storyId);

  const [title, setTitle] = useState(existingStory?.title ?? "");
  const [asA, setAsA] = useState(existingStory?.asA ?? "");
  const [iWant, setIWant] = useState(existingStory?.iWant ?? "");
  const [soThat, setSoThat] = useState(existingStory?.soThat ?? "");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<string[]>(
    existingStory?.acceptanceCriteria ?? [],
  );
  const [status, setStatus] = useState<UserStoryStatus>(
    existingStory?.status ?? "DRAFT",
  );
  const [tags, setTags] = useState<string[]>(existingStory?.tags ?? []);
  const [externalId, setExternalId] = useState(existingStory?.externalId ?? "");
  const [newCriterion, setNewCriterion] = useState("");
  const [newTag, setNewTag] = useState("");
  const [initialized, setInitialized] = useState(!isEditing);

  if (existingStory && !initialized) {
    setTitle(existingStory.title);
    setAsA(existingStory.asA);
    setIWant(existingStory.iWant);
    setSoThat(existingStory.soThat);
    setAcceptanceCriteria(existingStory.acceptanceCriteria);
    setStatus(existingStory.status);
    setTags(existingStory.tags);
    setExternalId(existingStory.externalId ?? "");
    setInitialized(true);
  }

  const createStory = useCreateUserStory(projectId);
  const updateStory = useUpdateUserStory(projectId, storyId ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: CreateUserStoryRequest = {
      title,
      asA,
      iWant,
      soThat,
      acceptanceCriteria,
      status,
      tags,
      externalId: externalId || undefined,
    };
    if (isEditing) {
      await updateStory.mutateAsync(data);
      onSaved?.(storyId!);
    } else {
      const newStory = await createStory.mutateAsync(data);
      onSaved?.(newStory.id);
    }
  };

  const addCriterion = () => {
    if (newCriterion.trim()) {
      setAcceptanceCriteria((prev) => [...prev, newCriterion.trim()]);
      setNewCriterion("");
    }
  };

  const removeCriterion = (index: number) => {
    setAcceptanceCriteria((prev) => prev.filter((_, i) => i !== index));
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags((prev) => [...prev, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  return {
    isEditing,
    isLoading,
    existingStory,
    title,
    setTitle,
    asA,
    setAsA,
    iWant,
    setIWant,
    soThat,
    setSoThat,
    acceptanceCriteria,
    status,
    setStatus,
    tags,
    externalId,
    setExternalId,
    newCriterion,
    setNewCriterion,
    newTag,
    setNewTag,
    handleSubmit,
    addCriterion,
    removeCriterion,
    addTag,
    removeTag,
    isValid: !!(title && asA && iWant && soThat),
    isPending: createStory.isPending || updateStory.isPending,
  };
}
