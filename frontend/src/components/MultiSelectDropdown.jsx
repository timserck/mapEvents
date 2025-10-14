import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export default function MultiSelectDropdown({
  options,
  selected,
  setSelected,
  label = "Options",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const buttonRef = useRef(null);
  const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 0, width: 0 });

  const toggleOption = (option) => {
    if (option === "all") {
      setSelected(["all"]);
    } else {
      const newSelected = selected.includes(option)
        ? selected.filter((s) => s !== option)
        : [...selected.filter((s) => s !== "all"), option];
      setSelected(newSelected.length === 0 ? ["all"] : newSelected);
    }
  };

  const isChecked = (option) => selected.includes(option);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const displayText =
    selected.includes("all")
      ? `${label}: Tous`
      : `${label}: ${selected.length} sélectionné${selected.length > 1 ? "s" : ""}`;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Position the dropdown below button
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left w-full" ref={buttonRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex justify-between items-center border rounded p-2 bg-white w-max sm:w-full"
      >
        <span>{displayText}</span>
        <svg
          className={`w-4 h-4 ml-2 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen &&
        createPortal(
          <div
            className="absolute z-[4000] bg-white border rounded shadow-lg max-h-60 overflow-auto sm:max-w-full"
            style={{
              top: dropdownCoords.top,
              left: dropdownCoords.left,
              width: window.innerWidth < 640 ? "90%" : dropdownCoords.width, // full width on mobile
              maxWidth: window.innerWidth < 640 ? "90%" : "auto",
            }}
          >
            <input
              type="text"
              placeholder={`Rechercher ${label.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border-b p-2 outline-none"
            />
            {filteredOptions.map((option) => (
              <label
                key={option}
                className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isChecked(option)}
                  onChange={() => toggleOption(option)}
                  className="mr-2"
                />
                {option === "all" ? "Tous les options" : option}
              </label>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
