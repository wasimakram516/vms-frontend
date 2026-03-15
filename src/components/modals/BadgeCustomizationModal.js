"use client";

import { useState, useEffect, useRef } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    TextField,
    IconButton,
    Divider,
    Stack,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
} from "@mui/material";
import RichTextEditor from "@/components/RichTextEditor";
import QRCode from "qrcode";
import ICONS from "@/utils/iconUtil";
import getStartIconSpacing from "@/utils/getStartIconSpacing";
import { useGlobalConfig } from "@/contexts/GlobalConfigContext";

const A6_WIDTH_PT = 297.6;
const A6_HEIGHT_PT = 419.5;
const PT_TO_PX = 96 / 72;
const A6_WIDTH_PX = A6_WIDTH_PT * PT_TO_PX;
const A6_HEIGHT_PX = A6_HEIGHT_PT * PT_TO_PX;
const PREVIEW_SCALE = 0.75;

const translations = {
    en: {
        title: "Customize Badge",
        xAxis: "X-Axis (%)",
        yAxis: "Y-Axis (%)",
        qrCode: "QR Code",
        qrSize: "Size (px)",
        save: "Save",
        cancel: "Cancel",
    },
    ,
};

const BadgeRichTextEditor = ({
    text,
    fontSize,
    color,
    isBold,
    isItalic,
    isUnderline,
    alignment,
    fontFamily,
    onTextChange,
    onFontSizeChange,
    onColorChange,
    onBoldChange,
    onItalicChange,
    onUnderlineChange,
    onAlignmentChange,
    onFontFamilyChange,
    x,
    y,
    onXChange,
    onYChange,
    placeholder,
    dir,
    minHeight,
    maxHeight,
    t,
    availableFonts = []
}) => {
    const editorContainerRef = useRef(null);
    const inputsContainerRef = useRef(null);
    const xInputRef = useRef(null);
    const yInputRef = useRef(null);
    const lastAlignmentRef = useRef(null);
    const lastFormattingRef = useRef({});

    const extractFormatting = (html) => {
        if (!html) {
            return {
                text: "",
                fontSize: 14,
                color: "#000000",
                isBold: false,
                isItalic: false,
                isUnderline: false,
                fontFamily: "Arial",
            };
        }

        let extractedText = html
            .replace(/<[^>]+>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .trim();

        const isBold = /<(strong|b)>/i.test(html) || /font-weight:\s*(bold|700|800|900)/i.test(html);

        const isItalic = /<(em|i)>/i.test(html) || /font-style:\s*italic/i.test(html);

        const isUnderline = /<u>/i.test(html) || /text-decoration:\s*underline/i.test(html);

        const colorMatch = html.match(/color:\s*([^;'"]+)/i) || html.match(/color="([^"]+)"/i);
        const extractedColor = colorMatch ? colorMatch[1].trim() : "#000000";

        let extractedFontSize = 14;
        const fontSizeMatch = html.match(/font-size:\s*([^;'"]+)/i);
        if (fontSizeMatch) {
            const sizeStr = fontSizeMatch[1].trim();
            const sizeNum = parseFloat(sizeStr);
            if (sizeNum && sizeNum >= 8 && sizeNum <= 50) {
                extractedFontSize = Math.round(sizeNum);
            }
        }

        const fontFamilyMatch = html.match(/font-family:\s*([^;'"]+)/i);
        const extractedFontFamily = fontFamilyMatch ? fontFamilyMatch[1].trim().replace(/['"]/g, '') : "Arial";

        return {
            text: extractedText,
            fontSize: extractedFontSize,
            color: extractedColor,
            isBold: !!isBold,
            isItalic: !!isItalic,
            isUnderline: !!isUnderline,
            fontFamily: extractedFontFamily,
        };
    };

    const buildHTML = (textValue, fontSizeValue, colorValue, isBoldValue, isItalicValue, isUnderlineValue, alignmentValue, fontFamilyValue) => {
        let html = String(textValue || "");

        if (isUnderlineValue) html = `<u>${html}</u>`;
        if (isItalicValue) html = `<em>${html}</em>`;
        if (isBoldValue) html = `<strong>${html}</strong>`;

        const styles = [];
        if (fontSizeValue && fontSizeValue !== 14) {
            styles.push(`font-size: ${fontSizeValue}px`);
        }
        if (colorValue && colorValue !== "#000000") {
            styles.push(`color: ${colorValue}`);
        }
        if (fontFamilyValue && fontFamilyValue !== "Arial") {
            styles.push(`font-family: ${fontFamilyValue}`);
        }
        if (alignmentValue && alignmentValue !== "left") {
            styles.push(`text-align: ${alignmentValue}`);
        }

        if (styles.length > 0) {
            html = `<span style="${styles.join("; ")}">${html}</span>`;
        }

        return `<p>${html}</p>`;
    };

    const handleHTMLChange = (html) => {
        if (isUpdatingFromPropsRef.current) {
            return;
        }

        const formatting = extractFormatting(html);

        const hasChanges =
            formatting.text !== lastFormattingRef.current.text ||
            formatting.fontSize !== lastFormattingRef.current.fontSize ||
            formatting.color !== lastFormattingRef.current.color ||
            formatting.isBold !== lastFormattingRef.current.isBold ||
            formatting.isItalic !== lastFormattingRef.current.isItalic ||
            formatting.isUnderline !== lastFormattingRef.current.isUnderline ||
            formatting.fontFamily !== lastFormattingRef.current.fontFamily;

        if (hasChanges) {
            if (onTextChange) {
                onTextChange(formatting.text);
            }
            if (onFontSizeChange) {
                onFontSizeChange(formatting.fontSize);
            }
            if (onColorChange) {
                onColorChange(formatting.color);
            }
            if (onBoldChange) {
                onBoldChange(formatting.isBold);
            }
            if (onItalicChange) {
                onItalicChange(formatting.isItalic);
            }
            if (onUnderlineChange) {
                onUnderlineChange(formatting.isUnderline);
            }
            if (onFontFamilyChange) {
                onFontFamilyChange(formatting.fontFamily);
            }

            lastFormattingRef.current = formatting;
        }
    };

    useEffect(() => {
        const checkAlignment = (isManualClick = false) => {
            if (!editorContainerRef.current) return;

            const editor = editorContainerRef.current.querySelector('[contenteditable="true"]');
            if (!editor) return;

            const isLeft = document.queryCommandState("justifyLeft");
            const isCenter = document.queryCommandState("justifyCenter");
            const isRight = document.queryCommandState("justifyRight");

            let currentAlignment = null;
            if (isLeft && !isCenter && !isRight) {
                currentAlignment = "left";
            } else if (isCenter && !isLeft && !isRight) {
                currentAlignment = "center";
            } else if (isRight && !isLeft && !isCenter) {
                currentAlignment = "right";
            }

            if (onAlignmentChange && isManualClick && currentAlignment && currentAlignment !== lastAlignmentRef.current) {
                lastAlignmentRef.current = currentAlignment;
                onAlignmentChange(currentAlignment);
            } else if (currentAlignment) {
                lastAlignmentRef.current = currentAlignment;
            }
        };

        const editor = editorContainerRef.current?.querySelector('[contenteditable="true"]');
        if (editor) {
            const toolbar = editorContainerRef.current.querySelector('.MuiToolbar-root');
            if (toolbar) {
                const alignmentButtons = toolbar.querySelectorAll('button[title*="Align"]');
                alignmentButtons.forEach(button => {
                    button.addEventListener('click', () => {
                        setTimeout(() => checkAlignment(true), 100);
                    });
                });
            }

            return () => {
            };
        }
    }, [onAlignmentChange]);

    useEffect(() => {
        const injectInputs = () => {
            const toolbar = editorContainerRef.current?.querySelector('.MuiToolbar-root');
            const clearFormatBox = toolbar?.querySelector('button[title="Clear Formatting"]')?.parentElement;

            if (clearFormatBox && !inputsContainerRef.current) {
                if (toolbar) {
                    toolbar.style.setProperty('padding-top', '12px', 'important');
                    toolbar.style.setProperty('padding-bottom', '12px', 'important');
                }

                const inputsBox = document.createElement('div');
                inputsBox.className = 'badge-position-inputs';
                inputsBox.style.display = 'flex';
                inputsBox.style.gap = '12px';
                inputsBox.style.alignItems = 'center';
                inputsBox.style.paddingLeft = '8px';
                inputsBox.style.paddingTop = '8px';
                inputsBox.style.paddingBottom = '8px';
                inputsBox.style.borderLeft = '1px solid';
                inputsBox.style.borderColor = 'rgba(0, 0, 0, 0.12)';
                inputsBox.style.marginLeft = '8px';
                inputsBox.style.marginTop = '8px';

                const xContainer = document.createElement('div');
                xContainer.style.display = 'flex';
                xContainer.style.alignItems = 'center';
                xContainer.style.gap = '6px';

                const xLabel = document.createElement('label');
                xLabel.textContent = t.xAxis;
                xLabel.style.fontSize = '0.875rem';
                xLabel.style.color = 'rgba(0, 0, 0, 0.6)';
                xLabel.style.fontWeight = '400';
                xLabel.style.whiteSpace = 'nowrap';

                const xInput = document.createElement('input');
                xInput.className = 'x-axis-input';
                xInput.type = 'number';
                xInput.min = 0;
                xInput.max = 100;
                xInput.step = 0.1;
                xInput.style.width = '80px';
                xInput.style.height = '32px';
                xInput.style.padding = '4px 8px';
                xInput.style.border = '1px solid rgba(0, 0, 0, 0.23)';
                xInput.style.borderRadius = '4px';
                xInput.style.fontSize = '0.875rem';
                xInput.value = x;
                xInput.oninput = (e) => {
                    const val = parseFloat(e.target.value) || 0;
                    if (val >= 0 && val <= 100) {
                        onXChange(val);
                    }
                };
                xInputRef.current = xInput;

                xContainer.appendChild(xLabel);
                xContainer.appendChild(xInput);

                const yContainer = document.createElement('div');
                yContainer.style.display = 'flex';
                yContainer.style.alignItems = 'center';
                yContainer.style.gap = '6px';

                const yLabel = document.createElement('label');
                yLabel.textContent = t.yAxis;
                yLabel.style.fontSize = '0.875rem';
                yLabel.style.color = 'rgba(0, 0, 0, 0.6)';
                yLabel.style.fontWeight = '400';
                yLabel.style.whiteSpace = 'nowrap';

                const yInput = document.createElement('input');
                yInput.className = 'y-axis-input';
                yInput.type = 'number';
                yInput.min = 0;
                yInput.max = 100;
                yInput.step = 0.1;
                yInput.style.width = '80px';
                yInput.style.height = '32px';
                yInput.style.padding = '4px 8px';
                yInput.style.border = '1px solid rgba(0, 0, 0, 0.23)';
                yInput.style.borderRadius = '4px';
                yInput.style.fontSize = '0.875rem';
                yInput.value = y;
                yInput.oninput = (e) => {
                    const val = parseFloat(e.target.value) || 0;
                    if (val >= 0 && val <= 100) {
                        onYChange(val);
                    }
                };
                yInputRef.current = yInput;

                yContainer.appendChild(yLabel);
                yContainer.appendChild(yInput);

                const fontContainer = document.createElement('div');
                fontContainer.style.display = 'flex';
                fontContainer.style.alignItems = 'center';
                fontContainer.style.gap = '4px';
                fontContainer.style.flexShrink = '1';
                fontContainer.style.minWidth = '0';

                const fontLabel = document.createElement('label');
                fontLabel.textContent = 'Font';
                fontLabel.style.fontSize = '0.875rem';
                fontLabel.style.color = 'rgba(0, 0, 0, 0.6)';
                fontLabel.style.fontWeight = '400';
                fontLabel.style.whiteSpace = 'nowrap';
                fontLabel.style.minWidth = 'auto';

                const fontSelect = document.createElement('select');
                fontSelect.className = 'font-family-select';
                fontSelect.style.width = '80px';
                fontSelect.style.height = '32px';
                fontSelect.style.padding = '4px 4px';
                fontSelect.style.border = '1px solid rgba(0, 0, 0, 0.23)';
                fontSelect.style.borderRadius = '4px';
                fontSelect.style.fontSize = '0.75rem';
                fontSelect.style.backgroundColor = 'white';
                fontSelect.value = fontFamily || 'Arial';

                const fontsToUse = availableFonts && availableFonts.length > 0 ? availableFonts : [
                    { name: "Arial", family: "Arial" },
                    { name: "Futura", family: "Futura" },
                    { name: "IBM Plex Sans Arabic", family: "IBM Plex Sans Arabic" }
                ];

                fontsToUse.forEach(font => {
                    const option = document.createElement('option');
                    option.value = font.family || font.name;
                    option.textContent = font.name || font.family;
                    option.style.fontFamily = font.family || font.name;
                    fontSelect.appendChild(option);
                });

                fontSelect.onchange = (e) => {
                    if (onFontFamilyChange) {
                        onFontFamilyChange(e.target.value);
                    }
                };

                fontContainer.appendChild(fontLabel);
                fontContainer.appendChild(fontSelect);

                inputsBox.appendChild(xContainer);
                inputsBox.appendChild(yContainer);
                inputsBox.appendChild(fontContainer);
                clearFormatBox.appendChild(inputsBox);
                inputsContainerRef.current = inputsBox;
            }
        };

        const timeoutId = setTimeout(injectInputs, 100);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [t, onXChange, onYChange, onFontFamilyChange, fontFamily, availableFonts, x, y]);

    useEffect(() => {
        if (xInputRef.current && document.activeElement !== xInputRef.current) {
            xInputRef.current.value = x;
        }
    }, [x]);

    useEffect(() => {
        if (yInputRef.current && document.activeElement !== yInputRef.current) {
            yInputRef.current.value = y;
        }
    }, [y]);

    const htmlValue = buildHTML(text || "", fontSize || 14, color || "#000000", isBold || false, isItalic || false, isUnderline || false, alignment || "left", fontFamily || "Arial");

    const isUpdatingFromPropsRef = useRef(false);

    useEffect(() => {
        if (editorContainerRef.current && !isUpdatingFromPropsRef.current) {
            const editor = editorContainerRef.current.querySelector('[contenteditable="true"]');
            if (editor) {
                const expectedHTML = buildHTML(text || "", fontSize || 14, color || "#000000", isBold || false, isItalic || false, isUnderline || false, alignment || "left", fontFamily || "Arial");
                if (editor.innerHTML !== expectedHTML) {
                    isUpdatingFromPropsRef.current = true;
                    editor.innerHTML = expectedHTML;
                    lastFormattingRef.current = {
                        text: text || "",
                        fontSize: fontSize || 14,
                        color: color || "#000000",
                        isBold: isBold || false,
                        isItalic: isItalic || false,
                        isUnderline: isUnderline || false,
                        fontFamily: fontFamily || "Arial",
                    };
                    setTimeout(() => {
                        isUpdatingFromPropsRef.current = false;
                    }, 0);
                }
            }
        }
    }, [text, fontSize, color, isBold, isItalic, isUnderline, alignment]);

    useEffect(() => {
        if (editorContainerRef.current) {
            const editor = editorContainerRef.current.querySelector('[contenteditable="true"]');
            if (editor) {
                const currentHTML = editor.innerHTML;
                const formatting = extractFormatting(currentHTML);
                lastFormattingRef.current = formatting;
            }
        }
    }, []);

    return (
        <Box>
            <Box ref={editorContainerRef}>
                <RichTextEditor
                    value={htmlValue}
                    onChange={handleHTMLChange}
                    placeholder={placeholder}
                    dir={dir}
                    minHeight={minHeight}
                    maxHeight={maxHeight}
                />
            </Box>
        </Box>
    );
};

export default function BadgeCustomizationModal({
    open,
    onClose,
    onSave,
    selectedFields = [],
    allFields = [],
    showQrOnBadge = false,
    badgeCustomizations = {},
}) {
    const t = translations.en || {};
  const dir = "ltr";
    const { fonts: availableFonts } = useGlobalConfig();
    const [customizations, setCustomizations] = useState({});
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
    const scrollableContainerRef = useRef(null);

    const setScrollableContainerRef = (node) => {
        if (scrollableContainerRef.current !== node) {
            scrollableContainerRef.current = node;
        }
    };

    useEffect(() => {
        if (open) {
            const initialCustomizations = {};
            selectedFields.forEach((fieldName) => {
                const field = allFields.find((f) => f.inputName === fieldName);
                if (field) {
                    const existing = badgeCustomizations[fieldName];

                    if (existing?.content && typeof existing.content === 'string' && existing.content.includes('<')) {
                        const html = existing.content;
                        const text = html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
                        const fontSizeMatch = html.match(/font-size:\s*([^;'"]+)/i);
                        const fontSize = fontSizeMatch ? parseFloat(fontSizeMatch[1]) : 14;
                        const colorMatch = html.match(/color:\s*([^;'"]+)/i);
                        const color = colorMatch ? colorMatch[1].trim() : "#000000";
                        const isBold = /<(strong|b)>/i.test(html);
                        const isItalic = /<(em|i)>/i.test(html);
                        const isUnderline = /<u>/i.test(html);

                        const fontFamilyMatch = html.match(/font-family:\s*([^;'"]+)/i);
                        const fontFamily = fontFamilyMatch ? fontFamilyMatch[1].trim().replace(/['"]/g, '') : "Arial";

                        initialCustomizations[fieldName] = {
                            text: text || `Sample ${fieldName}`,
                            fontSize: fontSize || 14,
                            color: color || "#000000",
                            isBold: !!isBold,
                            isItalic: !!isItalic,
                            isUnderline: !!isUnderline,
                            fontFamily: fontFamily || "Arial",
                            x: existing?.x !== undefined ? existing.x : 0,
                            y: existing?.y !== undefined ? existing.y : 0,
                            alignment: existing?.alignment || "left",
                        };
                    } else {
                        initialCustomizations[fieldName] = {
                            text: existing?.text || `Sample ${fieldName}`,
                            fontSize: existing?.fontSize !== undefined ? existing.fontSize : 14,
                            color: existing?.color || "#000000",
                            isBold: existing?.isBold !== undefined ? existing.isBold : false,
                            isItalic: existing?.isItalic !== undefined ? existing.isItalic : false,
                            isUnderline: existing?.isUnderline !== undefined ? existing.isUnderline : false,
                            fontFamily: existing?.fontFamily || "Arial",
                            x: existing?.x !== undefined ? existing.x : 0,
                            y: existing?.y !== undefined ? existing.y : 0,
                            alignment: existing?.alignment || "left",
                        };
                    }
                }
            });

            if (showQrOnBadge) {
                const existingQr = badgeCustomizations._qrCode;
                initialCustomizations._qrCode = {
                    x: existingQr?.x !== undefined ? existingQr.x : 5,
                    y: existingQr?.y !== undefined ? existingQr.y : 85,
                    size: existingQr?.size !== undefined ? existingQr.size : (existingQr?.width || 70),
                };
            }

            setCustomizations(initialCustomizations);
        }
    }, [open, selectedFields, allFields, showQrOnBadge, badgeCustomizations]);

    const generateQRCode = async (qrWidth = 70) => {
        try {
            const dataUrl = await QRCode.toDataURL("SAMPLE_TOKEN", {
                width: qrWidth,
                margin: 1,
                color: { dark: "#000000", light: "#ffffff" },
            });
            setQrCodeDataUrl(dataUrl);
        } catch (error) {
            console.error("Failed to generate QR code:", error);
        }
    };

    useEffect(() => {
        if (showQrOnBadge) {
            const qrSize = customizations._qrCode?.size ?? 70;
            generateQRCode(qrSize);
        }
    }, [customizations._qrCode?.size, showQrOnBadge]);

    useEffect(() => {
        if (!open || !availableFonts || availableFonts.length === 0) return;

        const styleId = 'badge-customization-fonts';
        let styleElement = document.getElementById(styleId);

        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = styleId;
            document.head.appendChild(styleElement);
        }

        let fontFaceCSS = '';

        availableFonts.forEach(font => {
            if (font.files && font.files.length > 0) {
                const fontVariants = new Map();

                font.files.forEach(file => {
                    const fontPath = file.path.startsWith('/') ? file.path : `/${file.path}`;
                    const variantKey = `${file.weight || 400}-${file.style || 'normal'}`;

                    if (!fontVariants.has(variantKey)) {
                        fontVariants.set(variantKey, []);
                    }
                    fontVariants.get(variantKey).push({
                        weight: file.weight || 400,
                        style: file.style || 'normal',
                        path: fontPath
                    });
                });

                fontVariants.forEach((variants, key) => {
                    if (variants.length > 0) {
                        const firstVariant = variants[0];
                        const format = firstVariant.path.endsWith('.otf') ? 'opentype' : 'truetype';

                        fontFaceCSS += `
@font-face {
  font-family: "${font.family}";
  src: url("${firstVariant.path}") format("${format}");
  font-weight: ${firstVariant.weight};
  font-style: ${firstVariant.style};
  font-display: swap;
}
`;
                    }
                });
            }
        });

        styleElement.textContent = fontFaceCSS;

        return () => {
        };
    }, [open, availableFonts]);

    useEffect(() => {
        if (open) {
            const container = scrollableContainerRef.current;

            if (container) {
                const resetScroll = () => {
                    if (container) {
                        container.scrollTop = 0;
                    }
                };

                resetScroll();

                requestAnimationFrame(() => {
                    resetScroll();
                    requestAnimationFrame(() => {
                        resetScroll();
                    });
                });

                const timeouts = [
                    setTimeout(resetScroll, 0),
                    setTimeout(resetScroll, 10),
                    setTimeout(resetScroll, 50),
                ];

                return () => {
                    timeouts.forEach(clearTimeout);
                };
            }
        }
    }, [open]);


    const handleFieldChange = (fieldName, key, value) => {
        setCustomizations((prev) => ({
            ...prev,
            [fieldName]: {
                ...prev[fieldName],
                [key]: value,
            },
        }));
    };

    const handleSave = () => {
        onSave(customizations);
        onClose();
    };

    const previewWidth = A6_WIDTH_PX * PREVIEW_SCALE;
    const previewHeight = A6_HEIGHT_PX * PREVIEW_SCALE;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            dir={dir}
            TransitionProps={{
                onEntered: () => {
                    const container = scrollableContainerRef.current;
                    if (container) {
                        container.scrollTop = 0;
                        requestAnimationFrame(() => {
                            if (container) {
                                container.scrollTop = 0;
                            }
                        });
                    }
                },
            }}
            PaperProps={{
                sx: {
                    height: "90vh",
                    maxHeight: "90vh",
                },
            }}
        >
            <DialogTitle
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontWeight: "bold",
                    px: 3,
                    pt: 3,
                }}
            >
                <Typography fontWeight="bold" fontSize="1.25rem">
                    {t.title}
                </Typography>
                <IconButton onClick={onClose} size="small">
                    <ICONS.close />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 0, display: "flex", height: "calc(90vh - 120px)", overflow: "hidden" }}>
                <Box
                    ref={setScrollableContainerRef}
                    sx={{
                        width: "50%",
                        borderRight: "1px solid",
                        borderColor: "divider",
                        overflowY: "auto",
                        p: 3,
                    }}
                >
                    <Stack spacing={3}>
                        {selectedFields.map((fieldName) => {
                            const field = allFields.find((f) => f.inputName === fieldName);
                            if (!field) return null;

                            const customization = customizations[fieldName] || {
                                content: `<p>Sample ${fieldName}</p>`,
                                x: 0,
                                y: 0,
                                alignment: "left",
                            };

                            return (
                                <Box key={fieldName}>
                                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                                        {fieldName}
                                    </Typography>
                                    <BadgeRichTextEditor
                                        text={customization.text || `Sample ${fieldName}`}
                                        fontSize={customization.fontSize || 14}
                                        color={customization.color || "#000000"}
                                        isBold={customization.isBold || false}
                                        isItalic={customization.isItalic || false}
                                        isUnderline={customization.isUnderline || false}
                                        alignment={customization.alignment || "left"}
                                        fontFamily={customization.fontFamily || "Arial"}
                                        onTextChange={(text) => handleFieldChange(fieldName, "text", text)}
                                        onFontSizeChange={(size) => handleFieldChange(fieldName, "fontSize", size)}
                                        onColorChange={(color) => handleFieldChange(fieldName, "color", color)}
                                        onBoldChange={(bold) => handleFieldChange(fieldName, "isBold", bold)}
                                        onItalicChange={(italic) => handleFieldChange(fieldName, "isItalic", italic)}
                                        onUnderlineChange={(underline) => handleFieldChange(fieldName, "isUnderline", underline)}
                                        onAlignmentChange={(alignment) => handleFieldChange(fieldName, "alignment", alignment)}
                                        onFontFamilyChange={(fontFamily) => handleFieldChange(fieldName, "fontFamily", fontFamily)}
                                        x={customization.x}
                                        y={customization.y}
                                        onXChange={(val) => handleFieldChange(fieldName, "x", val)}
                                        onYChange={(val) => handleFieldChange(fieldName, "y", val)}
                                        placeholder={`Enter ${fieldName} value...`}
                                        dir={dir}
                                        minHeight="120px"
                                        maxHeight="200px"
                                        t={t}
                                        availableFonts={availableFonts || []}
                                    />
                                    <Divider sx={{ mt: 3 }} />
                                </Box>
                            );
                        })}

                        {showQrOnBadge && (
                            <Box>
                                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                                    {t.qrCode}
                                </Typography>
                                <Box sx={{ display: "flex", gap: 2 }}>
                                    <TextField
                                        label={t.xAxis}
                                        type="number"
                                        value={customizations._qrCode?.x !== null && customizations._qrCode?.x !== undefined ? customizations._qrCode.x : 5}
                                        onChange={(e) => {
                                            const inputVal = e.target.value;
                                            if (inputVal === "") {
                                                handleFieldChange("_qrCode", "x", "");
                                                return;
                                            }
                                            const val = parseFloat(inputVal);
                                            if (!isNaN(val) && val >= 0 && val <= 100) {
                                                handleFieldChange("_qrCode", "x", val);
                                            }
                                        }}
                                        onBlur={(e) => {
                                            const inputVal = e.target.value.trim();
                                            if (inputVal === "" || isNaN(parseFloat(inputVal))) {
                                                handleFieldChange("_qrCode", "x", 5);
                                            } else {
                                                const val = parseFloat(inputVal);
                                                if (val < 0 || val > 100) {
                                                    handleFieldChange("_qrCode", "x", 5);
                                                }
                                            }
                                        }}
                                        size="small"
                                        sx={{ flex: 1 }}
                                        inputProps={{ min: 0, max: 100, step: 0.1 }}
                                    />
                                    <TextField
                                        label={t.yAxis}
                                        type="number"
                                        value={customizations._qrCode?.y !== null && customizations._qrCode?.y !== undefined ? customizations._qrCode.y : 85}
                                        onChange={(e) => {
                                            const inputVal = e.target.value;
                                            if (inputVal === "") {
                                                handleFieldChange("_qrCode", "y", "");
                                                return;
                                            }
                                            const val = parseFloat(inputVal);
                                            if (!isNaN(val) && val >= 0 && val <= 100) {
                                                handleFieldChange("_qrCode", "y", val);
                                            }
                                        }}
                                        onBlur={(e) => {
                                            const inputVal = e.target.value.trim();
                                            if (inputVal === "" || isNaN(parseFloat(inputVal))) {
                                                handleFieldChange("_qrCode", "y", 85);
                                            } else {
                                                const val = parseFloat(inputVal);
                                                if (val < 0 || val > 100) {
                                                    handleFieldChange("_qrCode", "y", 85);
                                                }
                                            }
                                        }}
                                        size="small"
                                        sx={{ flex: 1 }}
                                        inputProps={{ min: 0, max: 100, step: 0.1 }}
                                    />
                                    <TextField
                                        label={t.qrSize}
                                        type="number"
                                        value={customizations._qrCode?.size !== null && customizations._qrCode?.size !== undefined ? customizations._qrCode.size : 70}
                                        onChange={(e) => {
                                            const inputVal = e.target.value;
                                            if (inputVal === "") {
                                                handleFieldChange("_qrCode", "size", "");
                                                return;
                                            }
                                            const val = parseInt(inputVal);
                                            if (!isNaN(val) && val >= 0) {
                                                handleFieldChange("_qrCode", "size", val);
                                            }
                                        }}
                                        onBlur={(e) => {
                                            const inputVal = e.target.value.trim();
                                            if (inputVal === "" || isNaN(parseInt(inputVal))) {
                                                handleFieldChange("_qrCode", "size", 70);
                                            } else {
                                                const val = parseInt(inputVal);
                                                if (val < 10 || val > 200) {
                                                    handleFieldChange("_qrCode", "size", 70);
                                                }
                                            }
                                        }}
                                        size="small"
                                        sx={{ flex: 1 }}
                                        inputProps={{ min: 10, max: 200, step: 1 }}
                                    />
                                </Box>
                            </Box>
                        )}
                    </Stack>
                </Box>

                <Box
                    sx={{
                        width: "50%",
                        bgcolor: "grey.100",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        p: 0,
                        m: 0,
                        overflow: "auto",
                    }}
                >
                    <Box
                        sx={{
                            width: previewWidth,
                            height: previewHeight,
                            bgcolor: "white",
                            position: "relative",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                            border: "1px solid #ddd",
                            overflow: "hidden",
                            m: 0,
                        }}
                    >
                        <Box
                            sx={{
                                width: A6_WIDTH_PX,
                                height: A6_HEIGHT_PX,
                                bgcolor: "white",
                                position: "relative",
                                transform: `scale(${PREVIEW_SCALE})`,
                                transformOrigin: "top left",
                            }}
                        >
                            {selectedFields.map((fieldName) => {
                                const customization = customizations[fieldName];
                                if (!customization) return null;

                                const yPercent = customization.y || 0;
                                const alignment = customization.alignment || "left";
                                const text = customization.text || `Sample ${fieldName}`;
                                const fontSize = customization.fontSize || 14;
                                const color = customization.color || "#000000";
                                const isBold = customization.isBold || false;
                                const isItalic = customization.isItalic || false;
                                const isUnderline = customization.isUnderline || false;
                                const fontFamily = customization.fontFamily || "Arial";

                                let leftStyle = {};
                                let textAlignStyle = {};
                                let widthStyle = {};

                                if (alignment === "center") {

                                    leftStyle = { left: "5%" };
                                    textAlignStyle = { textAlign: "center" };
                                    widthStyle = { width: "90%", maxWidth: "90%" };
                                } else if (alignment === "right") {
                                    leftStyle = { right: "0%" };
                                    textAlignStyle = { textAlign: "right" };
                                    widthStyle = { maxWidth: "90%" };
                                } else {
                                    leftStyle = { left: `${customization.x || 0}%` };
                                    textAlignStyle = { textAlign: "left" };
                                    widthStyle = { maxWidth: "90%" };
                                }

                                return (
                                    <Box
                                        key={fieldName}
                                        sx={{
                                            position: "absolute",
                                            top: `${yPercent}%`,
                                            fontSize: `${fontSize}px`,
                                            fontFamily: `"${fontFamily}", sans-serif`,
                                            lineHeight: 1.0,
                                            color: color,
                                            fontWeight: isBold ? "bold" : "normal",
                                            fontStyle: isItalic ? "italic" : "normal",
                                            textDecoration: isUnderline ? "underline" : "none",
                                            margin: 0,
                                            padding: 0,
                                            display: "block",
                                            boxSizing: "border-box",
                                            height: "auto",
                                            minHeight: 0,
                                            ...leftStyle,
                                            ...textAlignStyle,
                                            ...widthStyle,
                                        }}
                                    >
                                        {text}
                                    </Box>
                                );
                            })}

                            {showQrOnBadge && qrCodeDataUrl && customizations._qrCode && (
                                <Box
                                    sx={{
                                        position: "absolute",
                                        left: `${customizations._qrCode.x ?? 5}%`,
                                        top: `${customizations._qrCode.y ?? 85}%`,
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                    }}
                                >
                                    <Box
                                        component="img"
                                        src={qrCodeDataUrl}
                                        alt="QR Code"
                                        sx={{
                                            width: `${customizations._qrCode.size ?? 70}px`,
                                            height: `${customizations._qrCode.size ?? 70}px`,
                                        }}
                                    />
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            fontSize: `${((customizations._qrCode.size ?? 70) / 70) * 9}px`,
                                            fontWeight: "bold",
                                            color: "#0077b6",
                                            letterSpacing: 0.7,
                                            marginTop: "2px",
                                        }}
                                    >
                                        SAMPLE_TOKEN
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </Box>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 3 }}>
                <Stack direction="row" spacing={2} sx={{ width: "100%", justifyContent: "flex-end" }}>
                    <Button
                        variant="outlined"
                        onClick={onClose}
                        startIcon={<ICONS.close />}
                        sx={{
                            ...getStartIconSpacing(dir),
                        }}
                    >
                        {t.cancel}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        startIcon={<ICONS.save />}
                        sx={{
                            ...getStartIconSpacing(dir),
                        }}
                    >
                        {t.save}
                    </Button>
                </Stack>
            </DialogActions>
        </Dialog>
    );
}

