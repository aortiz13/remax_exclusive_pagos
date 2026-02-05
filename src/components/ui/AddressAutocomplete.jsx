import { useState, useEffect, useRef } from "react";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
    Input
} from "@/components/ui";
import { MapPin, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// Nominatim API URL (OpenStreetMap)
const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";

const AddressAutocomplete = ({
    value,
    onChange,
    onSelectAddress,
    className,
    placeholder = "Buscar dirección..."
}) => {
    const [open, setOpen] = useState(false);
    const [internalValue, setInternalValue] = useState(value || "");
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const debounceTimer = useRef(null);

    useEffect(() => {
        if (value !== internalValue) {
            setInternalValue(value || "");
        }
    }, [value]);

    const searchAddress = async (query) => {
        if (!query || query.length < 3) {
            setSuggestions([]);
            return;
        }

        setLoading(true);
        try {
            const params = new URLSearchParams({
                q: query,
                format: 'json',
                addressdetails: 1,
                limit: 5,
                // countrycodes: 'cl' // Removed to allow international search if needed, or keep provided context. 
                // User searched for Uruguay address, so let's allow it or keep it strict? 
                // User said "ahora si aparecio" (now it appeared) for "Avenida Apoquindo" (Chile).
                // But previously complained about "Avenida 8 de octubre" (Uruguay) not appearing.
                // Let's keep strict 'cl' if they want Chile, but the primary issue is Z-INDEX.
                // I will keep 'cl' for now as they confirmed finding Apoquindo (Chile) worked in JSON but not UI.
                countrycodes: 'cl'
            });

            const response = await fetch(`${NOMINATIM_BASE_URL}?${params.toString()}`);
            const data = await response.json();
            setSuggestions(data || []);
        } catch (error) {
            console.error("Error fetching Nominatim data:", error);
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (val) => {
        setInternalValue(val);
        onChange(val);
        setOpen(true);

        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            searchAddress(val);
        }, 500);
    };

    const handleSelect = (item) => {
        const formattedAddress = item.display_name;
        const addressDetails = item.address;

        setInternalValue(formattedAddress);
        onChange(formattedAddress);
        setSuggestions([]);
        setOpen(false);

        if (onSelectAddress) {
            // Updated extraction logic for Chile/OSM:
            // - suburb: often "Las Condes", "Providencia"
            // - city: often "Santiago"
            // - town: sometimes smaller comunas
            // - neighbourhood: "Barrio El Faro" (not a comuna)
            const commune = addressDetails.suburb || addressDetails.city || addressDetails.town || addressDetails.village || addressDetails.county || "";
            const region = addressDetails.state || "";

            onSelectAddress({
                address: formattedAddress,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                commune,
                region,
                raw: item
            });
        }
    };

    return (
        <div className={cn("relative", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <div className="relative">
                        <Input
                            value={internalValue}
                            onChange={(e) => handleInputChange(e.target.value)}
                            placeholder={placeholder}
                            className="pr-8"
                            autoComplete="off"
                            role="combobox"
                            aria-expanded={open}
                        />
                        {loading ? (
                            <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                            <MapPin className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground opacity-50" />
                        )}
                    </div>
                </PopoverTrigger>
                {/* Fixed Z-Index: Modal is 100, so Popover must be higher */}
                <PopoverContent className="p-0 z-[200]" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <Command shouldFilter={false}>
                        <div className="hidden"><CommandInput value={internalValue} /></div>

                        <CommandList>
                            {suggestions.length > 0 ? (
                                suggestions.map((item) => (
                                    <CommandItem
                                        key={item.place_id}
                                        value={item.display_name}
                                        onSelect={() => handleSelect(item)}
                                        className="cursor-pointer"
                                    >
                                        <MapPin className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                                        <span>{item.display_name}</span>
                                    </CommandItem>
                                ))
                            ) : (
                                <CommandEmpty className="py-2 px-4 text-sm text-muted-foreground">
                                    {loading ? "Buscando..." : "Sin resultados."}
                                </CommandEmpty>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            <div className="text-[10px] text-muted-foreground text-right mt-1">
                Powered by <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline hover:text-black">OpenStreetMap</a>
            </div>
        </div>
    );
};

export default AddressAutocomplete;
