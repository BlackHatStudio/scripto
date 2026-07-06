"use client"

import { useEffect, useMemo, useState } from "react"
import { LoaderCircle, Plus, Search } from "lucide-react"

import { PageLayout } from "@/components/shell/page-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch } from "@/lib/api"

type DictionaryCategory = {
  id: string
  name: string
  scope: "system" | "tenant" | "user"
}

type DictionaryTerm = {
  id: string
  correctText: string
  spokenForm: string
  phoneticHint: string
  categoryId: string | null
  scope: "system" | "tenant" | "personal"
  caseSensitive: boolean
  enabled: boolean
  notes: string
}

const defaultForm = {
  correctText: "",
  spokenForm: "",
  phoneticHint: "",
  categoryId: "none",
  notes: "",
  caseSensitive: false,
  enabled: true,
}

export default function PersonalDictionaryPage() {
  const [terms, setTerms] = useState<DictionaryTerm[]>([])
  const [categories, setCategories] = useState<DictionaryCategory[]>([])
  const [search, setSearch] = useState("")
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [categoryItems, termItems] = await Promise.all([
          apiFetch<DictionaryCategory[]>("/dictionary/categories"),
          apiFetch<DictionaryTerm[]>("/dictionary/terms"),
        ])

        if (!active) return

        setCategories(categoryItems)
        setTerms(termItems)
      } catch (cause) {
        if (!active) return
        setError(cause instanceof Error ? cause.message : "Failed to load dictionary")
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  const filteredTerms = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return terms

    return terms.filter((term) => {
      const haystack = [
        term.correctText,
        term.spokenForm,
        term.phoneticHint,
        term.notes,
        term.scope,
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(needle)
    })
  }, [search, terms])

  async function saveTerm() {
    const correctText = form.correctText.trim()
    const spokenForm = form.spokenForm.trim()

    if (!correctText) {
      setError("Correct text is required.")
      return
    }

    setSaving(true)
    setError(null)
    setMessage(null)

    try {
      const saved = await apiFetch<DictionaryTerm>("/dictionary/terms", {
        method: "POST",
        body: JSON.stringify({
          correctText,
          spokenForm: spokenForm || correctText,
          phoneticHint: form.phoneticHint.trim(),
          categoryId: form.categoryId === "none" ? null : form.categoryId,
          scope: "personal",
          caseSensitive: form.caseSensitive,
          enabled: form.enabled,
          notes: form.notes.trim(),
        }),
      })

      setTerms((current) => [saved, ...current])
      setForm(defaultForm)
      setMessage("Dictionary term saved.")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save dictionary term")
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageLayout title="Personal Dictionary" subtitle="Personal terms, phonetics, and case-sensitive corrections">
      <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create term</CardTitle>
            <CardDescription>Personal terms are user-owned and highest precedence after system defaults.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Correct text"
              value={form.correctText}
              onChange={(event) => setForm((current) => ({ ...current, correctText: event.target.value }))}
            />
            <Input
              placeholder="Spoken form (defaults to correct text)"
              value={form.spokenForm}
              onFocus={() =>
                setForm((current) =>
                  current.spokenForm ? current : { ...current, spokenForm: current.correctText },
                )
              }
              onChange={(event) => setForm((current) => ({ ...current, spokenForm: event.target.value }))}
            />
            <Input
              placeholder="Phonetic hint"
              value={form.phoneticHint}
              onChange={(event) => setForm((current) => ({ ...current, phoneticHint: event.target.value }))}
            />
            <Select
              value={form.categoryId}
              onValueChange={(value) => setForm((current) => ({ ...current, categoryId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categories.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Notes"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.caseSensitive}
                onChange={(event) => setForm((current) => ({ ...current, caseSensitive: event.target.checked }))}
              />
              Case sensitive
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
              />
              Enabled
            </label>
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
            <Button className="w-full" onClick={saveTerm} disabled={saving || loading}>
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Save term
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Terms</CardTitle>
                <CardDescription>Search, filter, and manage personal dictionary terms.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Input
                  className="w-56"
                  placeholder="Search terms"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <Button variant="outline" type="button">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-left text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Correct text</th>
                    <th className="px-4 py-3">Spoken form</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-4 py-8 text-slate-400" colSpan={4}>
                        Loading dictionary terms...
                      </td>
                    </tr>
                  ) : filteredTerms.length ? (
                    filteredTerms.map((term) => {
                      const category = categories.find((item) => item.id === term.categoryId)

                      return (
                        <tr key={term.id} className="border-t border-white/10">
                          <td className="px-4 py-3 font-medium">{term.correctText}</td>
                          <td className="px-4 py-3 text-slate-400">{term.spokenForm}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{category?.name ?? "Uncategorized"}</Badge>
                              <Badge variant="secondary">{term.scope}</Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={term.enabled ? "success" : "secondary"}>
                              {term.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td className="px-4 py-8 text-slate-400" colSpan={4}>
                        No terms found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
