"use client";

import { useTranslations } from "next-intl";
import {
  ANNOUNCEMENT_RSVP_STATUSES,
  ANNOUNCEMENT_SIDES,
  PADRINHO_MODES,
  type Audience,
} from "@/lib/notifications/announcement-config";

export type EditorTag = { id: string; name: string; color: string | null };

function Chip({
  active,
  onClick,
  children,
  tone = "rose",
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: "rose" | "amber";
  disabled?: boolean;
}) {
  const on =
    tone === "amber"
      ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
      : "border-rose-500/50 bg-rose-500/15 text-rose-200";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={disabled}
      className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? on : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {children}
    </button>
  );
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function AudienceFilters({
  audience,
  tags,
  disabled,
  onChange,
}: {
  audience: Audience;
  tags: EditorTag[];
  disabled?: boolean;
  onChange: (next: Audience) => void;
}) {
  const t = useTranslations("dashboard.announcements.audience");

  return (
    <div className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-zinc-200">{t("rsvp.label")}</legend>
        <div className="flex flex-wrap gap-2">
          {ANNOUNCEMENT_RSVP_STATUSES.map((status) => {
            const active = audience.rsvpStatuses.includes(status);
            const isLast = active && audience.rsvpStatuses.length === 1;
            return (
              <Chip
                key={status}
                active={active}
                disabled={disabled || isLast}
                onClick={() => onChange({ ...audience, rsvpStatuses: toggle(audience.rsvpStatuses, status) })}
              >
                {t(`rsvp.${status}`)}
              </Chip>
            );
          })}
        </div>
        <p className="text-xs text-zinc-500">{t("rsvp.hint")}</p>
      </fieldset>

      {tags.length > 0 && (
        <>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-zinc-200">{t("includeTags.label")}</legend>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Chip
                  key={tag.id}
                  active={audience.includeTagIds.includes(tag.id)}
                  disabled={disabled}
                  onClick={() =>
                    onChange({
                      ...audience,
                      includeTagIds: toggle(audience.includeTagIds, tag.id),
                      excludeTagIds: audience.excludeTagIds.filter((id) => id !== tag.id),
                    })
                  }
                >
                  {tag.name}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-zinc-500">{t("includeTags.hint")}</p>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-zinc-200">{t("excludeTags.label")}</legend>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Chip
                  key={tag.id}
                  tone="amber"
                  active={audience.excludeTagIds.includes(tag.id)}
                  disabled={disabled}
                  onClick={() =>
                    onChange({
                      ...audience,
                      excludeTagIds: toggle(audience.excludeTagIds, tag.id),
                      includeTagIds: audience.includeTagIds.filter((id) => id !== tag.id),
                    })
                  }
                >
                  {tag.name}
                </Chip>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-zinc-200">{t("side.label")}</legend>
        <div className="flex flex-wrap gap-2">
          {ANNOUNCEMENT_SIDES.map((side) => (
            <Chip
              key={side}
              active={audience.sides.includes(side)}
              disabled={disabled}
              onClick={() => onChange({ ...audience, sides: toggle(audience.sides, side) })}
            >
              {t(`side.${side}`)}
            </Chip>
          ))}
        </div>
        <p className="text-xs text-zinc-500">{t("side.hint")}</p>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-zinc-200">{t("padrinhos.label")}</legend>
        <div className="flex flex-wrap gap-2">
          {PADRINHO_MODES.map((mode) => (
            <Chip
              key={mode}
              active={audience.padrinhos === mode}
              disabled={disabled}
              onClick={() => onChange({ ...audience, padrinhos: mode })}
            >
              {t(`padrinhos.${mode}`)}
            </Chip>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
