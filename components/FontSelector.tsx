import React from 'react';

interface Font {
    name: string;
    family: string;
}

const AVAILABLE_FONTS: Font[] = [
    { name: 'Caveat', family: 'Caveat, cursive' },
    { name: 'Dancing Script', family: '"Dancing Script", cursive' },
    { name: 'Patrick Hand', family: '"Patrick Hand", cursive' },
];

interface FontSelectorProps {
    selectedFont: string;
    onSelectFont: (fontFamily: string) => void;
}

const FontSelector: React.FC<FontSelectorProps> = ({ selectedFont, onSelectFont }) => {
    return (
        <div className="mb-8 p-4 bg-secondary border border-border-color rounded-lg">
            <h3 className="font-semibold mb-3 text-text-primary">Select Handwritten Font Style</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {AVAILABLE_FONTS.map(font => (
                    <button
                        key={font.name}
                        onClick={() => onSelectFont(font.name)}
                        className={`p-4 border-2 rounded-lg text-left transition-all ${selectedFont === font.name ? 'border-accent bg-blue-50' : 'border-border-color hover:border-gray-400'}`}
                    >
                        <p className="text-lg text-text-primary" style={{ fontFamily: font.family }}>
                            The quick brown fox jumps over the lazy dog.
                        </p>
                        <p className="text-sm text-text-secondary mt-2 font-sans">{font.name}</p>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default FontSelector;