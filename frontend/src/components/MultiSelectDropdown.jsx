import React, { useState, useRef, useEffect } from "react";

export default function MultiSelectDropdown({ options, selected, setSelected, label = "Options" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);

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

  // Filter options by search query
  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative inline-block text-left w-full md:w-auto" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center border rounded p-2 bg-white"
      >
        <span>
          {selected.includes("all") ? `${label}: Tous` : `${label}: ${selected.join(", ")}`}
        </span>
        <svg
          className={`w-4 h-4 ml-2 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute mt-1 w-full z-50 bg-white border rounded shadow-lg max-h-60 overflow-auto">
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
        </div>
      )}
    </div>
  );
}
