"use client";

import { useNewModelFlow } from "./useNewModelFlow";
import { MethodChooserScreen } from "./MethodChooserScreen";
import { ModelFormCard } from "./ModelFormCard";

export function NewModelFlow() {
  const f = useNewModelFlow();

  if (f.method === "choose") {
    return (
      <MethodChooserScreen
        backHref={f.backHref}
        backLabel={f.backLabel}
        onSelect={f.setMethod}
      />
    );
  }

  return (
    <ModelFormCard
      method={f.method}
      templateLabel={f.templateLabel}
      name={f.name}
      description={f.description}
      importContent={f.importContent}
      repoUrl={f.repoUrl}
      selectedProjectId={f.selectedProjectId}
      projectIdParam={f.projectIdParam}
      projects={f.projects}
      error={f.error}
      isPending={f.createModel.isPending}
      isImporting={f.isImporting}
      onNameChange={(v) => {
        f.setName(v);
        if (f.error) f.setError(null);
      }}
      onDescriptionChange={f.setDescription}
      onImportContentChange={f.setImportContent}
      onRepoUrlChange={f.setRepoUrl}
      onProjectChange={f.setSelectedProjectId}
      onBack={() => f.setMethod("choose")}
      onCreate={f.handleCreate}
    />
  );
}
