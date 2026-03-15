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
    const editorRef = useRef(null);
    const colorPickerAnchorRef = useRef(null);
    const fontSizeSelectRef = useRef(null);
    const [activeCommands, setActiveCommands] = useState({
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
    });
    const [alignment, setAlignment] = useState(null);
    const [fontSize, setFontSize] = useState(14);
    const [colorPickerOpen, setColorPickerOpen] = useState(false);

    const parseHTMLForFormatting = (html) => {
        if (!html) return { alignment: null, fontSize: 14 };

        let detectedAlignment = null;
        let detectedFontSize = 14;

        const textAlignMatch = html.match(/text-align:\s*(center|left|right|justify)/i);
        if (textAlignMatch) {
            const align = textAlignMatch[1].toLowerCase();
            if (align === 'center') detectedAlignment = 'center';
            else if (align === 'right') detectedAlignment = 'right';
            else if (align === 'left') detectedAlignment = 'left';
        }

        const fontSizeMatch = html.match(/font-size:\s*([^;'"]+)/i);
        if (fontSizeMatch) {
            const fontSizeStr = fontSizeMatch[1].trim();
            const fontSizeNum = parseFloat(fontSizeStr);
            if (fontSizeNum && fontSizeNum >= 8 && fontSizeNum <= 100) {
                detectedFontSize = Math.round(fontSizeNum);
            }
        }

        const fontSizeAttrMatch = html.match(/<font[^>]*size=["']?(\d+)["']?/i);
        if (fontSizeAttrMatch) {
            const sizeAttr = parseInt(fontSizeAttrMatch[1]);
            const sizeMap = {
                1: 8,
                2: 10,
                3: 12,
                4: 14,
                5: 18,
                6: 24,
                7: 36
            };
            if (sizeAttr >= 1 && sizeAttr <= 7) {
                detectedFontSize = sizeMap[sizeAttr];
            }
        }

        return { alignment: detectedAlignment, fontSize: detectedFontSize };
    };

    useEffect(() => {
        if (!editorRef.current) return;
        const el = editorRef.current;
        if (document.activeElement === el || el.contains(document.activeElement)) return;
        if (value === el.innerHTML) return;
        el.innerHTML = value || "";

        const formatting = parseHTMLForFormatting(value);

        if (formatting.alignment) {
            setAlignment(formatting.alignment);
            setTimeout(() => {
                if (editorRef.current) {
                    editorRef.current.focus();
                    const range = document.createRange();
                    range.selectNodeContents(editorRef.current);
                    range.collapse(false);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);

                    if (formatting.alignment === 'center') {
                        document.execCommand('justifyCenter', false, null);
                        editorRef.current.style.textAlign = "center";
                    } else if (formatting.alignment === 'right') {
                        document.execCommand('justifyRight', false, null);
                        editorRef.current.style.textAlign = "right";
                    } else {
                        document.execCommand('justifyLeft', false, null);
                        editorRef.current.style.textAlign = "left";
                    }

                    setTimeout(() => {
                        updateActiveCommands();
                    }, 0);
                }
            }, 50);
        } else {
            if (editorRef.current) {
                editorRef.current.style.textAlign = "left";
            }
        }

        if (formatting.fontSize !== fontSize) {
            setFontSize(formatting.fontSize);
        }
    }, [value]);

    const updateActiveCommands = () => {
        if (editorRef.current) {
            const isFocused = document.activeElement === editorRef.current;
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
            setAlignment("left");
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
        if (selection.rangeCount === 0) return;

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
            span.innerHTML = "\u200B";
            try {
                range.insertNode(span);
                range.setStartAfter(span);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            } catch (e) {
                editorRef.current.innerHTML += span.outerHTML;
            }
        } else {
            try {
                const span = document.createElement("span");
                span.style.fontSize = `${size}px`;
                range.surroundContents(span);
            } catch (e) {
                const contents = range.extractContents();
                const span = document.createElement("span");
                span.style.fontSize = `${size}px`;
                span.appendChild(contents);
                range.insertNode(span);
            }
        }

        setTimeout(() => {
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

            const zwsp = editorRef.current.querySelectorAll("span:not(:has(*))");
            zwsp.forEach((span) => {
                if (span.textContent === "\u200B" && span.style.fontSize) {
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
                    bgcolor: "grey.50",
                    gap: 0.5,
                    flexWrap: "wrap",
                    "& .MuiIconButton-root": {
                        padding: "4px",
                    },
                }}
            >
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
                        onClick={() => executeCommand("removeFormat")}
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
                onMouseUp={updateActiveCommands}
                onKeyUp={updateActiveCommands}
                dir={dir}
                sx={{
                    minHeight: minHeight || "96px",
                    maxHeight: maxHeight || "256px",
                    overflowY: "auto",
                    p: 2,
                    outline: "none",
                    fontSize: "14px",
                    lineHeight: 1.6,
                    color: "#333",
                    "&:empty:before": {
                        content: `"${placeholder}"`,
                        color: "text.disabled",
                    },
                    "& h1": { fontSize: "2em", fontWeight: "bold", margin: "0.67em 0" },
                    "& h2": { fontSize: "1.5em", fontWeight: "bold", margin: "0.75em 0" },
                    "& h3": { fontSize: "1.17em", fontWeight: "bold", margin: "0.83em 0" },
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

