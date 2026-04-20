"use client";

import React, { useState, useRef, useEffect } from "react";
import {
    Box,
    Toolbar,
    IconButton,
    Popover,
    Select,
    MenuItem,
    FormControl,
} from "@mui/material";
import { useColorMode } from "@/contexts/ThemeContext";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import FormatColorTextIcon from "@mui/icons-material/FormatColorText";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import StrikethroughSIcon from "@mui/icons-material/StrikethroughS";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import FormatAlignJustifyIcon from "@mui/icons-material/FormatAlignJustify";
import FormatClearIcon from "@mui/icons-material/FormatClear";

const RichTextEditor = ({ value, onChange, placeholder, dir, minHeight, maxHeight }) => {
    const { mode } = useColorMode();
    const isDark = mode === "dark";
    const editorRef = useRef(null);
    const colorPickerAnchorRef = useRef(null);
    const fontSizeSelectRef = useRef(null);
    // Persists the editor's selection range across focus-loss events (e.g. clicking the font-size dropdown).
    const savedRangeRef = useRef(null);
    const [activeCommands, setActiveCommands] = useState({
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
    });
    const [alignment, setAlignment] = useState(null);
    const [fontSize, setFontSize] = useState(12);
    const [colorPickerOpen, setColorPickerOpen] = useState(false);


    useEffect(() => {
        try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (_) {}
    }, []);

    useEffect(() => {
        if (!editorRef.current) return;
        const el = editorRef.current;
        if (document.activeElement === el || el.contains(document.activeElement)) return;
        if (value === el.innerHTML) return;
        el.innerHTML = value || "";

        // Detect alignment from first block element's inline style (reliable DOM read).
        const firstBlock = el.querySelector("p, h1, h2, h3");
        const detectedAlignment = firstBlock?.style?.textAlign || null;
        setAlignment(detectedAlignment);
        el.style.textAlign = detectedAlignment || "left";

        // Detect font size from first element that carries an explicit font-size style.
        // DOM traversal is more reliable than regex on the raw HTML string.
        const firstSized = el.querySelector("[style*='font-size']");
        let detectedFontSize = 12;
        if (firstSized?.style?.fontSize) {
            const px = parseFloat(firstSized.style.fontSize);
            if (!isNaN(px) && px >= 8 && px <= 100) detectedFontSize = Math.round(px);
        }
        setFontSize(detectedFontSize);
    }, [value]);

    const updateActiveCommands = () => {
        if (!editorRef.current) return;

        setActiveCommands({
            bold: document.queryCommandState("bold"),
            italic: document.queryCommandState("italic"),
            underline: document.queryCommandState("underline"),
            strikethrough: document.queryCommandState("strikethrough"),
        });

        const isLeft = document.queryCommandState("justifyLeft");
        const isCenter = document.queryCommandState("justifyCenter");
        const isRight = document.queryCommandState("justifyRight");
        const isFull = document.queryCommandState("justifyFull");

        if (isFull) setAlignment("justify");
        else if (isCenter && !isLeft && !isRight) setAlignment("center");
        else if (isRight && !isLeft && !isCenter) setAlignment("right");
        else if (isLeft && !isCenter && !isRight) setAlignment("left");
        else setAlignment(null);

        const blockFormat = document.queryCommandValue("formatBlock").toLowerCase().replace(/[<>]/g, "");
        // Detect font-size at cursor by walking up the DOM from the selection anchor
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            let node = selection.getRangeAt(0).startContainer;
            if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
            let detectedSize = null;
            while (node && node !== editorRef.current) {
                if (node.style && node.style.fontSize) {
                    const size = parseInt(node.style.fontSize);
                    if (!isNaN(size)) { detectedSize = size; break; }
                }
                node = node.parentElement;
            }
            setFontSize(detectedSize ?? 12);
        }
    };

    const handleInput = () => {
        if (editorRef.current && onChange) {
            onChange(editorRef.current.innerHTML);
        }
        const isCenter = document.queryCommandState("justifyCenter");
        const isRight = document.queryCommandState("justifyRight");
        const isFull = document.queryCommandState("justifyFull");

        if (isFull) editorRef.current.style.textAlign = "justify";
        else if (isCenter) editorRef.current.style.textAlign = "center";
        else if (isRight) editorRef.current.style.textAlign = "right";
        else editorRef.current.style.textAlign = "left";

        updateActiveCommands();
    };

    const handleFocus = () => {
        updateActiveCommands();
    };

    const handleBlur = () => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            savedRangeRef.current = sel.getRangeAt(0).cloneRange();
        }
    };


    const executeCommand = (command, value = null) => {
        editorRef.current?.focus();
        document.execCommand(command, false, value);
        setTimeout(() => {
            updateActiveCommands();
            handleInput();
        }, 0);
    };

    const handleAlignment = (align) => {
        if (!editorRef.current) return;

        if (alignment === align) {
            editorRef.current.focus();
            const selection = window.getSelection();
            if (selection.rangeCount === 0) {
                const range = document.createRange();
                range.selectNodeContents(editorRef.current);
                selection.removeAllRanges();
                selection.addRange(range);
            }

            const allElements = editorRef.current.querySelectorAll("*");
            allElements.forEach(el => {
                if (el.style && el.style.textAlign) {
                    el.style.textAlign = "";
                }
            });
            if (editorRef.current.style && editorRef.current.style.textAlign) {
                editorRef.current.style.textAlign = "";
            }

            document.execCommand("justifyLeft", false, null);
            setAlignment(null);
            setTimeout(() => {
                updateActiveCommands();
                handleInput();
            }, 0);
            return;
        }

        editorRef.current.focus();
        const selection = window.getSelection();
        if (selection.rangeCount === 0) {
            const range = document.createRange();
            range.selectNodeContents(editorRef.current);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        const range = selection.getRangeAt(0);

        const walker = document.createTreeWalker(
            editorRef.current,
            NodeFilter.SHOW_ELEMENT,
            null
        );

        const nodesToProcess = [];
        let node;
        while (node = walker.nextNode()) {
            if (node.style && node.style.textAlign) {
                if (range.intersectsNode(node) || node.contains(range.commonAncestorContainer)) {
                    nodesToProcess.push(node);
                }
            }
        }

        nodesToProcess.forEach(node => {
            node.style.textAlign = "";
        });

        if (editorRef.current.style && editorRef.current.style.textAlign) {
            editorRef.current.style.textAlign = "";
        }

        if (align === "left") {
            document.execCommand("justifyLeft", false, null);
        } else if (align === "center") {
            document.execCommand("justifyCenter", false, null);
        } else if (align === "right") {
            document.execCommand("justifyRight", false, null);
        } else if (align === "justify") {
            document.execCommand("justifyFull", false, null);
        }

        const alignMap = { center: "center", right: "right", justify: "justify" };
        editorRef.current.style.textAlign = alignMap[align] || "left";

        setAlignment(align);
        setTimeout(() => {
            updateActiveCommands();
            handleInput();
        }, 0);
    };

    const handleClearFormat = () => {
        if (!editorRef.current) return;
        editorRef.current.focus();
        document.execCommand("removeFormat", false, null);

        // removeFormat only strips inline styles (bold, italic, font-size, color).
        // Also clear block-level text-align from every paragraph in the selection.
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            editorRef.current.querySelectorAll("p, h1, h2, h3, li").forEach((block) => {
                if (range.intersectsNode(block)) {
                    block.style.textAlign = "";
                }
            });
        }
        editorRef.current.style.textAlign = "";
        setAlignment(null);

        setTimeout(() => {
            updateActiveCommands();
            handleInput();
        }, 0);
    };

    const handleFontColor = (color) => {
        executeCommand("foreColor", color);
        setColorPickerOpen(false);
    };

    const handleFontSize = (event) => {
        const size = parseInt(event.target.value);
        setFontSize(size);

        if (!editorRef.current) return;

        editorRef.current.focus();
        const selection = window.getSelection();

        // After clicking the font-size dropdown, the editor loses focus and the browser
        // clears the selection. Restore the last saved range so the font size is applied
        // to whatever the user had selected before opening the dropdown.
        if (!selection || selection.rangeCount === 0) {
            if (!savedRangeRef.current) return;
            selection.removeAllRanges();
            selection.addRange(savedRangeRef.current.cloneRange());
        }

        const range = selection.getRangeAt(0);

        try {
            document.execCommand("styleWithCSS", false, true);
        } catch (e) {
            // Browser doesn't support styleWithCSS
        }

        const removeFontSize = (element) => {
            if (element.style && element.style.fontSize) {
                element.style.fontSize = "";
            }
            const children = element.querySelectorAll("[style*='font-size']");
            children.forEach((child) => {
                if (child.style) {
                    child.style.fontSize = "";
                }
            });
        };

        if (range.collapsed) {
            let node = range.startContainer;
            while (node && node !== editorRef.current) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    removeFontSize(node);
                }
                node = node.parentElement;
            }
        } else {
            const walker = document.createTreeWalker(
                range.commonAncestorContainer,
                NodeFilter.SHOW_ELEMENT,
                {
                    acceptNode: (node) => {
                        return range.intersectsNode(node)
                            ? NodeFilter.FILTER_ACCEPT
                            : NodeFilter.FILTER_REJECT;
                    }
                }
            );

            let node;
            const nodesToProcess = [];
            while (node = walker.nextNode()) {
                nodesToProcess.push(node);
            }

            if (range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE) {
                nodesToProcess.push(range.commonAncestorContainer);
            }

            nodesToProcess.forEach(removeFontSize);
        }

        if (range.collapsed) {
            const span = document.createElement("span");
            span.style.fontSize = `${size}px`;
            span.appendChild(document.createTextNode("\u200B"));
            try {
                range.insertNode(span);
                // Place cursor INSIDE the span so subsequent typed characters inherit the font size.
                const inner = document.createRange();
                inner.setStart(span.firstChild, 1);
                inner.collapse(true);
                selection.removeAllRanges();
                selection.addRange(inner);
            } catch (e) {
                editorRef.current.innerHTML += span.outerHTML;
            }
        } else {
            try {
                const span = document.createElement("span");
                span.style.fontSize = `${size}px`;
                range.surroundContents(span);
            } catch (e) {
                // Selection spans multiple block elements — apply font size per block
                // to preserve paragraph structure instead of wrapping everything in one span.
                const blocks = editorRef.current.querySelectorAll("p, h1, h2, h3, li");
                blocks.forEach((block) => {
                    if (range.intersectsNode(block)) {
                        const wrapper = document.createElement("span");
                        wrapper.style.fontSize = `${size}px`;
                        while (block.firstChild) {
                            wrapper.appendChild(block.firstChild);
                        }
                        block.appendChild(wrapper);
                    }
                });
            }
        }

        setTimeout(() => {
            // Unwrap redundant nested font-size spans that carry the same size.
            const spans = editorRef.current.querySelectorAll("span[style*='font-size']");
            spans.forEach((span) => {
                const parent = span.parentElement;
                if (parent && parent.tagName === "SPAN" &&
                    parent.style.fontSize &&
                    parent.style.fontSize === span.style.fontSize) {
                    const fragment = document.createDocumentFragment();
                    while (span.firstChild) {
                        fragment.appendChild(span.firstChild);
                    }
                    parent.insertBefore(fragment, span);
                    span.remove();
                }
            });

            // Remove stale zero-width placeholder spans (only \u200B, no real text).
            // Avoid removing the span the cursor is currently inside.
            const sel = window.getSelection();
            const cursorNode = sel?.rangeCount > 0 ? sel.getRangeAt(0).startContainer : null;
            editorRef.current.querySelectorAll("span").forEach((span) => {
                if (span.textContent === "\u200B") {
                    const cursorInside = cursorNode && (span === cursorNode || span.contains(cursorNode));
                    if (!cursorInside) span.remove();
                }
            });

            updateActiveCommands();
            handleInput();
        }, 10);
    };

    return (
        <Box
            sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                overflow: "hidden",
                "&:focus-within": {
                    borderColor: "primary.main",
                },
            }}
        >
            <Toolbar
                variant="dense"
                sx={{
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    minHeight: "40px !important",
                    bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                    gap: 0.5,
                    flexWrap: "wrap",
                    "& .MuiIconButton-root": {
                        padding: "4px",
                    },
                }}
            >
                <Box sx={{ display: "flex", gap: 0.5, borderRight: "1px solid", borderColor: "divider", pr: 0.5 }}>
                </Box>

                <Box sx={{ display: "flex", gap: 0.5, borderRight: "1px solid", borderColor: "divider", pr: 0.5 }}>
                    <IconButton
                        size="small"
                        onClick={() => executeCommand("bold")}
                        sx={{
                            bgcolor: activeCommands.bold ? "action.selected" : "transparent",
                        }}
                        title="Bold (Ctrl+B)"
                    >
                        <FormatBoldIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={() => executeCommand("italic")}
                        sx={{
                            bgcolor: activeCommands.italic ? "action.selected" : "transparent",
                        }}
                        title="Italic (Ctrl+I)"
                    >
                        <FormatItalicIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={() => executeCommand("underline")}
                        sx={{
                            bgcolor: activeCommands.underline ? "action.selected" : "transparent",
                        }}
                        title="Underline (Ctrl+U)"
                    >
                        <FormatUnderlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={() => executeCommand("strikethrough")}
                        sx={{
                            bgcolor: activeCommands.strikethrough ? "action.selected" : "transparent",
                        }}
                        title="Strikethrough"
                    >
                        <StrikethroughSIcon fontSize="small" />
                    </IconButton>
                </Box>

                <Box sx={{ display: "flex", gap: 0.5, borderRight: "1px solid", borderColor: "divider", px: 0.5 }}>
                    <IconButton
                        size="small"
                        ref={colorPickerAnchorRef}
                        onClick={() => setColorPickerOpen(true)}
                        title="Text Color"
                    >
                        <FormatColorTextIcon fontSize="small" />
                    </IconButton>
                    <Popover
                        open={colorPickerOpen}
                        anchorEl={colorPickerAnchorRef.current}
                        onClose={() => setColorPickerOpen(false)}
                        anchorOrigin={{
                            vertical: "bottom",
                            horizontal: "left",
                        }}
                    >
                        <Box sx={{ p: 2, display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 1 }}>
                            {[
                                "#000000", "#333333", "#666666", "#999999",
                                "#FF0000", "#00FF00", "#0000FF", "#FFFF00",
                                "#FF00FF", "#00FFFF", "#FFA500", "#800080",
                                "#FFC0CB", "#A52A2A", "#000080", "#008000",
                                "#FFFFFF",
                            ].map((color) => (
                                <Box
                                    key={color}
                                    onClick={() => handleFontColor(color)}
                                    sx={{
                                        width: 24,
                                        height: 24,
                                        bgcolor: color,
                                        border: color === "#FFFFFF" ? "1px solid #999" : "1px solid #ccc",
                                        cursor: "pointer",
                                        "&:hover": { border: "2px solid #000" },
                                    }}
                                />
                            ))}
                        </Box>
                    </Popover>
                </Box>

                <Box sx={{ display: "flex", gap: 0.5, borderRight: "1px solid", borderColor: "divider", px: 0.5 }}>
                    <IconButton
                        size="small"
                        onClick={() => executeCommand("insertUnorderedList")}
                        title="Bullet List"
                    >
                        <FormatListBulletedIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={() => executeCommand("insertOrderedList")}
                        title="Numbered List"
                    >
                        <FormatListNumberedIcon fontSize="small" />
                    </IconButton>
                </Box>

                <Box sx={{ display: "flex", gap: 0.5, borderRight: "1px solid", borderColor: "divider", px: 0.5 }}>
                    <IconButton
                        size="small"
                        onClick={() => handleAlignment("left")}
                        sx={{
                            bgcolor: alignment === "left" ? "action.selected" : "transparent",
                        }}
                        title="Align Left"
                    >
                        <FormatAlignLeftIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={() => handleAlignment("center")}
                        sx={{
                            bgcolor: alignment === "center" ? "action.selected" : "transparent",
                        }}
                        title="Align Center"
                    >
                        <FormatAlignCenterIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={() => handleAlignment("right")}
                        sx={{
                            bgcolor: alignment === "right" ? "action.selected" : "transparent",
                        }}
                        title="Align Right"
                    >
                        <FormatAlignRightIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={() => handleAlignment("justify")}
                        sx={{ bgcolor: alignment === "justify" ? "action.selected" : "transparent" }}
                        title="Justify"
                    >
                        <FormatAlignJustifyIcon fontSize="small" />
                    </IconButton>
                </Box>

                <Box sx={{ display: "flex", gap: 0.5, borderRight: "1px solid", borderColor: "divider", px: 0.5, alignItems: "center" }}>
                    <FormControl size="small" variant="outlined" sx={{ minWidth: 80 }}>
                        <Select
                            value={fontSize}
                            onChange={handleFontSize}
                            displayEmpty
                            inputRef={fontSizeSelectRef}
                            MenuProps={{
                                PaperProps: {
                                    style: {
                                        maxHeight: 240,
                                    },
                                },
                            }}
                            sx={{
                                height: "32px",
                                fontSize: "0.875rem",
                                "& .MuiOutlinedInput-notchedOutline": {
                                    borderWidth: "1px",
                                },
                            }}
                        >
                            {Array.from({ length: 93 }, (_, i) => i + 8).map((size) => (
                                <MenuItem key={size} value={size}>
                                    {size}px
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>

                <Box sx={{ display: "flex", gap: 0.5, px: 0.5 }}>
                    <IconButton
                        size="small"
                        onClick={handleClearFormat}
                        title="Clear Formatting"
                    >
                        <FormatClearIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Toolbar>
            <Box
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onMouseUp={updateActiveCommands}
                onKeyUp={updateActiveCommands}
                onSelect={updateActiveCommands}
                onClick={updateActiveCommands}
                dir={dir}
                sx={{
                    minHeight: minHeight || "96px",
                    maxHeight: maxHeight || "256px",
                    overflowY: "auto",
                    p: 2,
                    outline: "none",
                    fontSize: "12px",
                    lineHeight: 1.6,
                    color: "text.primary",
                    "&:empty:before": {
                        content: `"${placeholder}"`,
                        color: "text.disabled",
                    },
                    "& ul, & ol": { margin: "1em 0", paddingLeft: "2.5em" },
                    "& ul": { listStyleType: "disc" },
                    "& ol": { listStyleType: "decimal" },
                    "& li": { margin: "0.5em 0" },
                    "& p": { margin: "1em 0" },
                    "& strong, & b": { fontWeight: "bold" },
                    "& em, & i": { fontStyle: "italic" },
                    "& u": { textDecoration: "underline" },
                    "& s, & strike": { textDecoration: "line-through" },
                }}
            />
        </Box>
    );
};

export default RichTextEditor;

