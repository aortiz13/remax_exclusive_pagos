import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, getCustomPublicUrl } from '../services/supabase';
import { triggerEvaluacionComercialWebhook } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { logActivity } from '../services/activityService';
import {
    Card, CardContent, Button, Input, Label,
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
    Textarea
} from '@/components/ui';
import AddressAutocomplete from '../components/ui/AddressAutocomplete';
import {
    ArrowLeft, Building2, User, FileText, Send,
    Upload, Loader2, X, Home, ClipboardList,
    Search, MapPin, Mail, Phone, FileDigit, Plus,
    FileType, Trash2
} from 'lucide-react';

export default function EvaluacionComercialForm() {
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [properties, setProperties] = useState([]);
    const [loadingProperties, setLoadingProperties] = useState(true);

    // Form State
    const [observaciones, setObservaciones] = useState('');
    const [selectedPropertyId, setSelectedPropertyId] = useState('none');

    // Datos Propiedad
    const [propRol, setPropRol] = useState('');
    const [propDireccion, setPropDireccion] = useState('');
    const [propComuna, setPropComuna] = useState('');

    // Datos Propietario
    const [propNombre, setPropNombre] = useState('');
    const [propRut, setPropRut] = useState('');
    const [propEmail, setPropEmail] = useState('');
    const [propTelefono, setPropTelefono] = useState('');
    const [propDirParticular, setPropDirParticular] = useState('');

    // Documentos
    const [files, setFiles] = useState([]);
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchProperties();
    }, []);

    const fetchProperties = async () => {
        try {
            const { data, error } = await supabase
                .from('properties')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProperties(data || []);
        } catch (error) {
            console.error('Error fetching properties:', error);
            toast.error('Error cargando propiedades');
        } finally {
            setLoadingProperties(false);
        }
    };

    const handlePropertySelect = async (propId) => {
        setSelectedPropertyId(propId);
        if (propId === 'none') {
            resetPropertyData();
            return;
        }

        const prop = properties.find(p => p.id === propId);
        if (prop) {
            setPropDireccion(prop.address || '');
            setPropComuna(prop.commune || '');
            setPropRol(prop.tax_id || prop.role || '');
        }

        // Fetch contact with role "Propietario"
        try {
            const { data: contactRoles, error: rolesError } = await supabase
                .from('property_contacts')
                .select('contact_id, role')
                .eq('property_id', propId)
                .ilike('role', '%propietario%');

            if (rolesError) throw rolesError;

            if (contactRoles && contactRoles.length > 0) {
                const ownerId = contactRoles[0].contact_id;
                const { data: contactData, error: contactError } = await supabase
                    .from('contacts')
                    .select('*')
                    .eq('id', ownerId)
                    .single();

                if (contactError) throw contactError;

                if (contactData) {
                    setPropNombre(`${contactData.first_name || ''} ${contactData.last_name || ''}`.trim());
                    setPropRut(contactData.rut || '');
                    setPropEmail(contactData.email || '');
                    setPropTelefono(contactData.phone || '');
                    setPropDirParticular(contactData.address || '');
                    toast.success('Datos del propietario autocompletados');
                }
            }
        } catch (error) {
            console.error('Error fetching owner details:', error);
        }
    };

    const resetPropertyData = () => {
        setPropRol('');
        setPropDireccion('');
        setPropComuna('');
        setPropNombre('');
        setPropRut('');
        setPropEmail('');
        setPropTelefono('');
        setPropDirParticular('');
    };

    const handleAddressSelect = (data) => {
        setPropDireccion(data.address);
        setPropComuna(data.commune);
    };

    const handleFileChange = (e) => {
        const newFiles = Array.from(e.target.files);
        setFiles(prev => [...prev, ...newFiles]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const validateForm = () => {
        if (!propDireccion) return "La dirección de la propiedad es obligatoria.";
        if (!propNombre || !propRut) return "Nombre y RUT del propietario son obligatorios.";
        if (files.length === 0) return "Debe adjuntar al menos un documento.";
        return null;
    };

    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    };

    const submitRequest = async () => {
        setShowConfirm(false);
        setIsSubmitting(true);

        try {
            const base64Files = await Promise.all(
                files.map(async (file) => {
                    const base64String = await fileToBase64(file);
                    return {
                        nombre: file.name,
                        tipo: file.type,
                        base64: base64String
                    };
                })
            );

            // Upload files to Supabase Storage
            const uploadFiles = async (filesArray) => {
                const uploadedUrls = [];
                for (const file of filesArray) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
                    const filePath = `evaluacion_comercial/${new Date().getTime()}/${fileName}`;

                    const { error: uploadError } = await supabase.storage
                        .from('contracts')
                        .upload(filePath, file);

                    if (uploadError) throw uploadError;

                    const publicUrl = getCustomPublicUrl('contracts', filePath)
                    uploadedUrls.push({ name: file.name, url: publicUrl });
                }
                return uploadedUrls;
            };

            const uploadedDocsUrls = await uploadFiles(files);

            const payloadData = {
                tipo_solicitud: 'Evaluación Comercial',
                observaciones: observaciones,
                fecha_hora: new Date().toISOString(),
                agente: {
                    nombre: profile?.first_name || '',
                    apellido: profile?.last_name || '',
                    correo: user?.email || '',
                    telefono: profile?.phone || ''
                },
                propiedad: {
                    rol: propRol,
                    direccion: propDireccion,
                    comuna: propComuna
                },
                propietario: {
                    nombre_apellido: propNombre,
                    rut: propRut,
                    correo: propEmail,
                    telefono: propTelefono,
                    direccion_particular: propDirParticular
                }
            };

            const dbPayload = {
                user_id: user?.id,
                type: 'evaluacion_comercial',
                status: 'submitted',
                data: {
                    ...payloadData,
                    archivos_adjuntos: uploadedDocsUrls
                }
            };
            const { error: dbError } = await supabase.from('requests').insert(dbPayload);
            if (dbError) throw dbError;

            const webhookPayload = {
                ...payloadData,
                documentos: base64Files
            };

            await triggerEvaluacionComercialWebhook(webhookPayload);

            toast.success('Solicitud enviada exitosamente');

            // Log to timeline
            logActivity({
                action: 'Solicitud',
                entity_type: selectedPropertyId !== 'none' ? 'Propiedad' : 'Contacto',
                entity_id: selectedPropertyId !== 'none' ? selectedPropertyId : null,
                description: `Evaluación Comercial enviada: ${propDireccion}`,
                property_id: selectedPropertyId !== 'none' ? selectedPropertyId : null,
                details: { request_type: 'evaluacion_comercial', address: propDireccion }
            }).catch(() => { });

            navigate('/dashboard');
        } catch (error) {
            console.error('Error submitting evaluacion comercial:', error);
            toast.error('Ocurrió un error al enviar la solicitud.');
            setIsSubmitting(false);
        }
    };

    const handleConfirmRequest = (e) => {
        e.preventDefault();
        const errorMsg = validateForm();
        if (errorMsg) {
            toast.error(errorMsg);
            return;
        }
        setShowConfirm(true);
    };

    return (
        <div className="min-h-screen bg-[#f8f9fc] dark:bg-slate-950 flex flex-col font-sans">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                        onClick={() => navigate('/new-request')}
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                            Solicitud de Evaluación Comercial
                        </h1>
                        <p className="text-sm text-slate-500 font-medium">Completa los detalles para generar la orden de tasación</p>
                    </div>
                    <div className="hidden sm:block">
                        <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-[#003aad] dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider rounded-full border border-blue-100 dark:border-blue-900/50">
                            Nueva Solicitud
                        </span>
                    </div>
                </div>
                {/* Brand line */}
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#003aad] via-[#003aad] to-[#dc1c2e] opacity-80" />
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 space-y-8 pb-32">

                {/* Section 1: Datos de la Propiedad */}
                <Card className="overflow-hidden border-slate-100 dark:border-slate-800 shadow-sm group transition-all duration-300 hover:shadow-md">
                    <CardContent className="p-6 md:p-8">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-[#dc1c2e] dark:text-red-400">
                                <Home className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Datos de la Propiedad</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">Información del inmueble a evaluar.</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Propiedad Asociada</Label>
                                <div className="relative">
                                    <Select value={selectedPropertyId} onValueChange={handlePropertySelect}>
                                        <SelectTrigger className="h-12">
                                            <SelectValue placeholder="Buscar en mis propiedades..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Ingresar manualmente</SelectItem>
                                            {properties.map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Rol</Label>
                                    <Input
                                        className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                        placeholder="No definido"
                                        value={propRol}
                                        onChange={(e) => setPropRol(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Comuna</Label>
                                    <Input
                                        className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                        placeholder="Especifique comuna"
                                        value={propComuna}
                                        onChange={(e) => setPropComuna(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Ubicación Exacta / Dirección <span className="text-[#dc1c2e]">*</span>
                                </Label>
                                <AddressAutocomplete
                                    value={propDireccion}
                                    onChange={setPropDireccion}
                                    onSelectAddress={handleAddressSelect}
                                    placeholder="Buscar dirección para autocompletar..."
                                    className="h-12"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Section 2: Datos del Propietario */}
                <Card className="overflow-hidden border-slate-100 dark:border-slate-800 shadow-sm group transition-all duration-300 hover:shadow-md">
                    <CardContent className="p-6 md:p-8">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-[#003aad] dark:text-blue-400">
                                <User className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Datos del Propietario</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">Información de contacto del cliente.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Nombre y Apellido <span className="text-[#dc1c2e]">*</span>
                                </Label>
                                <Input
                                    className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                    placeholder="Ej. Juan Pérez"
                                    value={propNombre}
                                    onChange={(e) => setPropNombre(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    RUT <span className="text-[#dc1c2e]">*</span>
                                </Label>
                                <Input
                                    className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                    placeholder="12.345.678-9"
                                    value={propRut}
                                    onChange={(e) => setPropRut(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Correo Electrónico</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                                    <Input
                                        className="h-11 pl-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                        placeholder="correo@ejemplo.com"
                                        value={propEmail}
                                        onChange={(e) => setPropEmail(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Teléfono</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                                    <Input
                                        className="h-11 pl-10 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                        placeholder="+56 9..."
                                        value={propTelefono}
                                        onChange={(e) => setPropTelefono(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="md:col-span-2 space-y-2">
                                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Dirección Particular</Label>
                                <Input
                                    className="h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                    placeholder="Calle, Número, Depto"
                                    value={propDirParticular}
                                    onChange={(e) => setPropDirParticular(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Section 3: Documentos Adjuntos */}
                <Card className="overflow-hidden border-slate-100 dark:border-slate-800 shadow-sm group transition-all duration-300 hover:shadow-md">
                    <CardContent className="p-6 md:p-8">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-[#dc1c2e] dark:text-red-400">
                                <FileText className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Documentos Adjuntos</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">Sube escrituras, planos o documentos relevantes.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label
                                className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-900/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:border-[#003aad]/50 transition-all duration-300 group/upload"
                            >
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <div className="mb-3 p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm text-slate-400 group-hover/upload:text-[#003aad] transition-colors">
                                        <Upload className="w-8 h-8" />
                                    </div>
                                    <p className="mb-2 text-sm text-slate-700 dark:text-slate-300">
                                        <span className="font-bold text-[#003aad] dark:text-blue-400">Haz clic para subir</span> o arrastra y suelta
                                    </p>
                                    <p className="text-xs text-slate-500 italic">Soportado: PDF, JPG, PNG (Max. 10MB)</p>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    multiple
                                    onChange={handleFileChange}
                                />
                            </label>

                            {files.length > 0 && (
                                <div className="mt-6 space-y-2">
                                    {files.map((file, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg group/item hover:border-blue-200 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded ${file.type.includes('pdf') ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                                    <FileType className="w-4 h-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px] sm:max-w-md">
                                                        {file.name}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                onClick={() => removeFile(idx)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="pt-6 space-y-2">
                                <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Observaciones Generales</Label>
                                <Textarea
                                    className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 resize-none"
                                    placeholder="Detalles adicionales relevantes, instrucciones o notas para el tasador..."
                                    rows={4}
                                    value={observaciones}
                                    onChange={(e) => setObservaciones(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </main>

            {/* Sticky Footer */}
            <footer className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
                    <Button
                        variant="ghost"
                        className="px-6 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                        onClick={() => navigate('/dashboard')}
                    >
                        Cancelar
                    </Button>
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] text-slate-400 hidden sm:inline uppercase tracking-widest font-bold">
                            Campos con <span className="text-[#dc1c2e]">*</span> son obligatorios
                        </span>
                        <Button
                            className="px-8 bg-[#003aad] hover:bg-[#002a80] dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold h-11 rounded-lg shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2"
                            onClick={handleConfirmRequest}
                        >
                            <span>Enviar Solicitud</span>
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </footer>

            {/* Confirm Modal */}
            <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-center text-xl font-bold">Confirmar Envío</DialogTitle>
                    </DialogHeader>
                    <div className="py-6 space-y-4 text-center">
                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto text-[#003aad]">
                            <Send className="w-8 h-8" />
                        </div>
                        <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                            ¿Deseas enviar la solicitud ahora?
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Se notificará al equipo administrativo con la información de {propNombre} para la propiedad en {propDireccion}.
                        </p>
                    </div>
                    <DialogFooter className="flex flex-col sm:flex-row gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setShowConfirm(false)}
                            disabled={isSubmitting}
                            className="flex-1"
                        >
                            Revisar Datos
                        </Button>
                        <Button
                            onClick={submitRequest}
                            disabled={isSubmitting}
                            className="flex-1 bg-[#003aad] dark:bg-blue-600"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                "Sí, Enviar"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
