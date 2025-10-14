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
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 0, width: 0 });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch(""); // reset search on close
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // Position the dropdown relative to the button
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
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex justify-between items-center border rounded p-2 bg-white w-max"
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
            className="absolute z-[4000] bg-white border rounded shadow-lg max-h-60 overflow-auto"
            style={{
              top: dropdownCoords.top,
              left: dropdownCoords.left,
              width: dropdownCoords.width,
            }}
          >
            {/* Search Input */}
            <input
              type="text"
              placeholder={`Rechercher ${label.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border-b p-2 outline-none"
            />
            {/* Options List */}
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
