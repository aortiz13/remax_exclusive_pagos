import { useState, useEffect } from "react";
import usePlacesAutocomplete, {
    getGeocode,
    getLatLng,
} from "use-places-autocomplete";
import { useJsApiLoader } from "@react-google-maps/api";
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Input,
    Button
} from "@/components/ui";
import { Check, ChevronsUpDown, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const libraries = ["places"];

const AddressAutocomplete = ({
    value,
    onChange,
    onSelectAddress,
    className,
    placeholder = "Buscar dirección..."
}) => {
    const { isLoaded, loadError } = useJsApiLoader({
        googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
        libraries,
    });

    const {
        ready,
        value: searchValue,
        suggestions: { status, data },
        setValue,
        clearSuggestions,
    } = usePlacesAutocomplete({
        requestOptions: {
            componentRestrictions: { country: "cl" }, // Restrict to Chile by default, can be made prop
        },
        debounce: 300,
        defaultValue: value
    });

    const [open, setOpen] = useState(false);

    // Sync internal value with external value prop
    useEffect(() => {
        if (value !== searchValue) {
            setValue(value, false);
        }
    }, [value]);


    const handleSelect = async (address) => {
        setValue(address, false);
        clearSuggestions();
        setOpen(false); // Close dropdown

        if (onChange) onChange(address);

        try {
            const results = await getGeocode({ address });
            const { lat, lng } = await getLatLng(results[0]);

            // Parse components for structured data if needed
            const addressComponents = results[0].address_components;
            let commune = "";
            let region = "";

            addressComponents.forEach(component => {
                if (component.types.includes("administrative_area_level_3") || component.types.includes("locality")) {
                    commune = component.long_name;
                }
                if (component.types.includes("administrative_area_level_1")) {
                    region = component.long_name;
                }
            });

            if (onSelectAddress) {
                onSelectAddress({
                    address: address,
                    lat,
                    lng,
                    commune,
                    region,
                    raw: results[0]
                });
            }
        } catch (error) {
            console.log("Error: ", error);
        }
    };

    if (loadError) {
        return (
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Error cargando Google Maps. Ingrese manual."
                className={cn("border-red-300", className)}
            />
        );
    }

    if (!isLoaded) {
        return (
            <div className="relative">
                <Input disabled placeholder="Cargando Google Maps..." className={className} />
                <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
            </div>
        )
    }

    // Fallback if no API key is provided but script loaded (shouldn't happen with useJsApiLoader usually unless key is invalid)
    if (!ready && !searchValue) {
        // Allow manual typing even if not ready? 
        // Actually usePlacesAutocomplete 'ready' might depend on script loading.
    }

    return (
        <div className={cn("relative", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <div className="relative">
                        <Input
                            value={searchValue}
                            onChange={(e) => {
                                setValue(e.target.value);
                                onChange(e.target.value);
                                if (e.target.value) setOpen(true);
                            }}
                            disabled={!ready}
                            placeholder={placeholder}
                            className="pr-8"
                            autoComplete="off"
                        />
                        <MapPin className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground opacity-50" />
                    </div>
                </PopoverTrigger>
                <PopoverContent className="p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <Command>
                        {/* Hidden input to prevent Command from filtering internally, we want Google results */}
                        <div className="hidden"><CommandInput /></div>

                        <CommandList>
                            {status === "OK" && data.map(({ place_id, description }) => (
                                <CommandItem
                                    key={place_id}
                                    value={description} // Command uses this for filtering, but we are driving it.
                                    onSelect={() => handleSelect(description)}
                                    className="cursor-pointer"
                                >
                                    <MapPin className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                                    <span>{description}</span>
                                </CommandItem>
                            ))}
                            {status === "ZERO_RESULTS" && (
                                <CommandEmpty>No se encontraron direcciones.</CommandEmpty>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
};

export default AddressAutocomplete;
