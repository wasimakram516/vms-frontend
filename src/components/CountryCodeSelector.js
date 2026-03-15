"use client";

import React, { useState, useMemo } from "react";
import {
    Select,
    MenuItem,
    InputAdornment,
    Box,
    Typography,
    TextField,
    InputBase,
    ListSubheader,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE, DEFAULT_ISO_CODE, getFlagImageUrl, getCountryCodeByIsoCode, getCountryCodeByCode } from "@/utils/countryCodes";

const CountryCodeSelector = ({
    value,
    onChange,
    disabled = false,
    dir = "ltr",
}) => {
    const [searchQuery, setSearchQuery] = useState("");

    let selectedIsoCode = null;
    if (value) {
        if (/^[a-z]{2,3}$/i.test(value)) {
            selectedIsoCode = value.toLowerCase();
        } else {
            const country = getCountryCodeByCode(value);
            selectedIsoCode = country?.isoCode || DEFAULT_ISO_CODE;
        }
    } else {
        selectedIsoCode = DEFAULT_ISO_CODE;
    }

    const selectedCountry = COUNTRY_CODES.find((cc) => cc.isoCode === selectedIsoCode) ||
        COUNTRY_CODES.find((cc) => cc.isoCode === DEFAULT_ISO_CODE);

    const filteredCountries = useMemo(() => {
        if (!searchQuery.trim()) {
            return COUNTRY_CODES;
        }
        const query = searchQuery.toLowerCase();
        return COUNTRY_CODES.filter(
            (country) =>
                country.country.toLowerCase().includes(query) ||
                country.code.includes(query) ||
                country.isoCode.toLowerCase().includes(query)
        );
    }, [searchQuery]);

    return (
        <InputAdornment position="start" sx={{ m: 0 }}>
            <Select
                value={selectedIsoCode}
                onChange={(e) => {
                    const isoCode = e.target.value;
                    onChange(isoCode);
                }}
                disabled={disabled}
                renderValue={(selected) => {
                    const country = COUNTRY_CODES.find((cc) => cc.isoCode === selected);
                    return (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, pr: 0.5 }}>
                            {country?.isoCode && (
                                <img
                                    src={getFlagImageUrl(country.isoCode)}
                                    alt={country.country}
                                    style={{
                                        width: "20px",
                                        height: "15px",
                                        objectFit: "cover",
                                        borderRadius: "2px",
                                    }}
                                />
                            )}
                            <span style={{ fontSize: "14px", marginRight: "2px" }}>{country?.code || selected}</span>
                        </Box>
                    );
                }}
                sx={{
                    "& .MuiSelect-select": {
                        py: 1,
                        pl: 1,
                        pr: "24px !important",
                        minWidth: "auto",
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        border: "none",
                        "&:focus": {
                            backgroundColor: "transparent",
                        },
                    },
                    "& .MuiOutlinedInput-notchedOutline": {
                        border: "none",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                        border: "none",
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        border: "none",
                    },
                    "& .MuiSelect-icon": {
                        right: "4px !important",
                        width: "16px",
                    },
                }}
                MenuProps={{
                    PaperProps: {
                        sx: {
                            maxHeight: 400,
                        },
                    },
                    autoFocus: false,
                }}
                onClose={() => setSearchQuery("")}
            >
                <ListSubheader
                    sx={{
                        position: "sticky",
                        top: 0,
                        backgroundColor: "background.paper",
                        zIndex: 1,
                        p: 0,
                        borderBottom: "1px solid",
                        borderColor: "divider",
                    }}
                >
                    <Box sx={{ p: 1.5 }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Search country..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    backgroundColor: "background.default",
                                },
                            }}
                        />
                    </Box>
                </ListSubheader>
                {filteredCountries.length > 0 ? (
                    filteredCountries.map((country) => (
                        <MenuItem key={country.isoCode} value={country.isoCode}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                {country.isoCode && (
                                    <img
                                        src={getFlagImageUrl(country.isoCode)}
                                        alt={country.country}
                                        style={{
                                            width: "24px",
                                            height: "18px",
                                            objectFit: "cover",
                                            borderRadius: "2px",
                                        }}
                                    />
                                )}
                                <Typography variant="body2">
                                    {country.country} ({country.code})
                                </Typography>
                            </Box>
                        </MenuItem>
                    ))
                ) : (
                    <MenuItem disabled>
                        <Typography variant="body2" color="text.secondary">
                            No countries found
                        </Typography>
                    </MenuItem>
                )}
            </Select>
        </InputAdornment>
    );
};

export default CountryCodeSelector;

