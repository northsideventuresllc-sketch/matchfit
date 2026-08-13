"use client";

import { useEffect, useMemo, useState } from "react";
import { AsYouType, getCountries, getCountryCallingCode, isValidPhoneNumber, type CountryCode } from "libphonenumber-js";

const PRIORITY_COUNTRIES: CountryCode[] = ["US", "CA", "GB", "AU"];

let regionNames: Intl.DisplayNames | null = null;
function countryLabel(code: CountryCode): string {
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

const COUNTRY_OPTIONS: { code: CountryCode; label: string }[] = (() => {
  const all = getCountries();
  const withLabel = all.map((code) => ({ code, label: countryLabel(code) })).sort((a, b) => a.label.localeCompare(b.label));
  const priority = PRIORITY_COUNTRIES.filter((c) => all.includes(c)).map((code) => ({ code, label: countryLabel(code) }));
  return [...priority, ...withLabel.filter((c) => !PRIORITY_COUNTRIES.includes(c.code))];
})();

export type PhoneNumberValue = { e164: string; isValid: boolean };

export function PhoneNumberField({
  id,
  label,
  defaultCountry = "US",
  required,
  onChange,
}: {
  id: string;
  label: string;
  defaultCountry?: CountryCode;
  required?: boolean;
  onChange: (value: PhoneNumberValue) => void;
}) {
  const [country, setCountry] = useState<CountryCode>(defaultCountry);
  const [nationalInput, setNationalInput] = useState("");

  const value = useMemo<PhoneNumberValue>(() => {
    const digits = nationalInput.replace(/\D/g, "");
    if (!digits) return { e164: "", isValid: false };
    let callingCode: string;
    try {
      callingCode = getCountryCallingCode(country);
    } catch {
      return { e164: "", isValid: false };
    }
    const e164 = `+${callingCode}${digits}`;
    return { e164, isValid: isValidPhoneNumber(e164) };
  }, [country, nationalInput]);

  useEffect(() => {
    onChange(value);
    // Only the derived value should re-notify the parent — onChange itself is expected to be a
    // fresh closure every render (it captures the parent's setState), so it's deliberately left
    // out of the dependency list to avoid re-firing on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function formatOnBlur() {
    const digits = nationalInput.replace(/\D/g, "");
    if (!digits) return;
    const formatter = new AsYouType(country);
    formatter.input(digits);
    const formatted = formatter.getNumber()?.formatNational();
    if (formatted) setNationalInput(formatted);
  }

  const showInvalid = nationalInput.trim().length > 0 && !value.isValid;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-white/50">
        {label}
      </label>
      <div className="flex gap-2">
        <select
          aria-label="Country code"
          value={country}
          onChange={(e) => {
            setCountry(e.target.value as CountryCode);
            setNationalInput("");
          }}
          className="shrink-0 rounded-xl border border-white/10 bg-[#0E1016] px-2 py-3 text-[13px] text-white outline-none focus:border-[#FF7E00]/40 sm:text-[15px]"
        >
          {COUNTRY_OPTIONS.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label} (+{getCountryCallingCode(c.code)})
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required={required}
          value={nationalInput}
          onChange={(e) => setNationalInput(e.target.value.replace(/[^\d\s().-]/g, ""))}
          onBlur={formatOnBlur}
          placeholder="Phone number"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0E1016] px-4 py-3 text-[15px] text-white outline-none ring-[#FF7E00]/40 transition placeholder:text-white/25 focus:border-[#FF7E00]/40 focus:ring-2"
        />
      </div>
      {showInvalid ? <p className="text-xs text-[#FFB4B4]">Enter a valid phone number for the selected country.</p> : null}
    </div>
  );
}
