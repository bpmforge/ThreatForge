"use client";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CreationMethod } from "./methods";

const LABEL_TEXT: Partial<Record<CreationMethod, string>> = {
  "import-terraform": "Paste .tf content or",
  "import-kubernetes": "Paste YAML manifests or",
  "import-docker-compose": "Paste docker-compose.yml or",
  "import-tool": "Paste file content or",
  "import-yaml": "Paste YAML content or",
};

const PLACEHOLDERS: Partial<Record<CreationMethod, string>> = {
  "import-terraform":
    'resource "aws_instance" "web" {\n  ami = "ami-0c55b159cbfafe1f0"\n  instance_type = "t3.micro"\n}',
  "import-kubernetes":
    "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web-app\nspec:\n  ...",
  "import-docker-compose":
    "version: '3.8'\nservices:\n  web:\n    image: nginx\n  db:\n    image: postgres",
  "import-yaml":
    "version: '1.0'\nname: My Model\ncomponents:\n  - id: web\n    name: Web App\n    type: WEB_APP",
  "import-tool": "Paste the exported file content here...",
};

const FILE_ACCEPT: Partial<Record<CreationMethod, string>> = {
  "import-terraform": ".tf",
  "import-kubernetes": ".yaml,.yml",
  "import-docker-compose": ".yaml,.yml",
  "import-yaml": ".yaml,.yml",
  "import-tool": ".tm7,.json,.yaml,.yml",
};

interface ImportContentFieldProps {
  method: CreationMethod;
  value: string;
  onChange: (value: string) => void;
}

export function ImportContentField({
  method,
  value,
  onChange,
}: ImportContentFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Label htmlFor="importContent">{LABEL_TEXT[method]}</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => document.getElementById("importFile")?.click()}
        >
          Browse file
        </Button>
        <input
          id="importFile"
          type="file"
          className="hidden"
          accept={FILE_ACCEPT[method]}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) onChange(await file.text());
          }}
        />
      </div>
      <Textarea
        id="importContent"
        placeholder={PLACEHOLDERS[method]}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        className="resize-none font-mono text-xs"
      />
    </div>
  );
}
