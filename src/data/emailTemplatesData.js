/**
 * Plantillas de correo predefinidas para la Casilla de Correos.
 * Cada plantilla contiene: id, name, category, subject, bodyHtml.
 * Los campos con _________ son espacios en blanco que el usuario
 * debe rellenar manualmente tras aplicar la plantilla.
 */

export const EMAIL_TEMPLATES = [
  {
    id: 'vista-casa-exito',
    name: 'Vista su Casa para el Éxito',
    category: 'Post-Captación',
    subject: '"VISTA SU CASA PARA EL ÉXITO" Sugerencias para mostrar su propiedad',
    bodyHtml: `<p>Estimado/a _______________, un gusto saludarle nuevamente, primero que todo quiero agradecer la confianza depositada en nuestra empresa <strong>REMAX Exclusive</strong> al entregarnos su propiedad para la venta/arriendo, la cual he procedido a publicitar en múltiples portales web para su comercialización. En breve tendremos clientes interesados en visitar su casa/departamento y como su objetivo y el mío, es vender/arrendar a la mayor brevedad, en el mejor precio del mercado y con las menores molestias, me permito enumerar algunas recomendaciones importantes para lograr el objetivo de VENTA/ARRIENDO:</p>
<ul>
<li>Ventanas limpias.</li>
<li>Timbre funcionando.</li>
<li>Olor agradable.</li>
<li>Entrada y habitaciones limpias y ordenadas.</li>
<li>Manillas y cerraduras en buenas condiciones.</li>
<li>Guardar muebles innecesarios.</li>
<li>Closet ordenado.</li>
<li>Cocina y gabinetes limpios y ordenados.</li>
<li>Baños limpios y ordenados.</li>
<li>Cortinas y/o persianas en buen estado.</li>
<li>Enchufes e interruptores en buen estado.</li>
<li>Cristales y espejos limpios.</li>
<li>Paredes y sócalos en buen estado.</li>
<li>Cuadros sin polvo y bien colocados.</li>
<li>Pasto cortado y en buen estado.</li>
</ul>
<p>Antes de recibir al prospecto Comprador es conveniente:</p>
<ul>
<li>Encender luces en toda la casa/departamento.</li>
<li>Provocar un aroma agradable y fresco.</li>
</ul>
<p>Estas pautas le darán a su propiedad una ventaja sobre las demás que compiten por la atención de posibles compradores.</p>`
  },
  {
    id: 'servicio-vendedores',
    name: 'Servicio Intermediación (Vendedores/Arrendadores)',
    category: 'Presentación de Servicios',
    subject: 'Servicio de Intermediación Inmobiliaria REMAX Exclusive (Vendedores o Arrendadores)',
    bodyHtml: `<p>¡Buenas tardes _______________!, junto con saludar y esperando que se encuentre muy bien, le hago llegar una presentación de mis servicios como Agente Inmobiliario en <strong>REMAX Chile</strong> red internacional de franquicias inmobiliarias líder en ventas a nivel mundial con más de 53 años de experiencia y presencia en más de 115 países, en Chile ya cuenta con más de 50 oficinas de norte a sur y más de 1.000 Agentes Comerciales Asociados.</p>
<p><strong>Nuestros Servicios</strong> se basan en la atención personalizada y la comunicación constante, lo que se resume en una relación de confianza.</p>
<p><strong>Nuestra Misión</strong> es promover un servicio de asesoría inmobiliaria que exceda las expectativas de nuestros clientes, priorizando siempre a las personas y cultivando relaciones a largo plazo.</p>
<p><strong>Nuestra propuesta de valor se compone de una serie de procesos los cuales enumero a continuación:</strong></p>
<ul>
<li>Plan de marketing específico para la venta o arriendo de su inmueble, dependiendo de las características de la propiedad se estudian cuáles son los medios más indicados para promocionar la venta o el arriendo de la misma.</li>
<li>Valoración comercial sin costo para ayudar al propietario a determinar el mejor precio de venta y/o arriendo de su propiedad y mantenerle informado de los cambios del mercado.</li>
<li>Se sube la propiedad con todas las características y fotografías profesionales a la página Web <strong>REMAX</strong>, y de esta manera la propiedad aparece automáticamente en nuestro sistema MLS y en más de 20 portales inmobiliarios y es compartido por más de 1.000 agentes de nuestra red.</li>
<li>Finalmente y algo muy importante es la sinergia que existe con el cliente, es decir, de forma continua informaré al propietario de todo lo que se está haciendo por su propiedad y los resultados de las llamadas, visitas y ofertas, de tal manera que tenga un control absoluto en cuanto al trabajo de venta o arriendo de su inmueble.</li>
</ul>
<p>Si está interesado en que avance en la captación de su propiedad en _______________ (venta/arriendo), requiero que me haga llegar por esta vía la dirección exacta y características como año de construcción, Mt2 aproximados, número de estacionamientos y bodega, año de escritura y titular, para así poder realizar una valoración comercial y podemos organizar una reunión para el día _______________ a las _____ hrs. para así poder ampliar mi presentación y analizar dicha valoración comercial.</p>`
  },
  {
    id: 'servicio-compradores',
    name: 'Servicio Intermediación (Compradores/Arrendatarios)',
    category: 'Presentación de Servicios',
    subject: 'Servicio de Intermediación Inmobiliaria REMAX Exclusive (Compradores o Arrendatarios)',
    bodyHtml: `<p>¡Buenas tardes _______________!, junto con saludar y esperando que se encuentre muy bien, le hago llegar una presentación de mis servicios como Agente Inmobiliario en <strong>REMAX Chile</strong> red internacional de franquicias inmobiliarias líder en ventas a nivel mundial con más de 53 años de experiencia y presencia en más de 115 países, en Chile ya cuenta con más de 50 oficinas de norte a sur y más de 1.000 Agentes Comerciales Asociados.</p>
<p><strong>Nuestros Servicios</strong> se basan en la atención personalizada y la comunicación constante, lo que se resume en una relación de confianza.</p>
<p><strong>Nuestra Misión</strong> es promover un servicio de asesoría inmobiliaria que exceda las expectativas de nuestros clientes, priorizando siempre a las personas y cultivando relaciones a largo plazo.</p>
<p><strong>Nuestra propuesta de valor</strong> se compone de una serie de procesos los cuales enumero a continuación:</p>
<ul>
<li>Análisis de las necesidades del comprador o arrendatario: una vez planteadas las necesidades de compra del cliente, se introduce la búsqueda en nuestro sistema MLS en donde se encuentra la bolsa inmobiliaria con la oferta de propiedades más amplia del sector en todo Chile, gracias a esta bolsa inmobiliaria el comprador podrá acceder a todas las propiedades incluidas en ella, lo que permite acceder al mayor número de inmuebles posibles los cuales se ajusten a sus necesidades.</li>
<li>Filtro de propiedades adaptadas a las necesidades reales del comprador o el arrendatario: de esta manera usted no perderá tiempo en visitas a inmuebles que no le interesan ya que haremos un exhaustivo análisis para poder ofrecerle las propiedades que más se ajusten a sus necesidades.</li>
<li>Asesoramiento íntegro y máxima negociación: el comprador o arrendatario siempre contará con el asesoramiento más profesional y con la actuación de un único interlocutor con una dilatada experiencia y resultados de éxito que garantizarán la búsqueda de la propiedad más idónea para usted.</li>
</ul>
<p>Lo invito a que organicemos una reunión para el día _______________ a las _________ hrs. para así poder ampliar mi presentación y obtener un Feed Back de sus necesidades.</p>
<p>Agradeciendo de antemano su atención, quedo a la espera de sus comentarios.</p>`
  },
  {
    id: 'correo-corredoras',
    name: 'Correo para otras Corredoras',
    category: 'Gestión',
    subject: 'Correo tipo para enviar a otras corredoras',
    bodyHtml: `<p>Buenas tardes _______________, primero que todo quiero agradecer por su tiempo el día de hoy, de acuerdo a lo conversado le envío un correo tipo para ser enviado a las corredoras que hoy está publicando su inmueble en venta/arriendo; el título puede ser en EN EL TEXTO y me puede copiar a mi en dicho correo.</p>
<p>Junto con saludarle le escribo para manifestarle mi decisión de que la venta/arriendo de la propiedad ubicada en _______________, comuna de _________, sea manejada solo por una empresa, por lo cual dicha gestión será realizada a partir de este momento de manera exclusiva por RE/MAX Exclusive, siendo atendido por el Agente Asociado _______________.</p>
<p>Sin embargo esto no significa que usted quede fuera del negocio, debido a que por política RE/MAX ellos están abiertos al canje con otras corredoras acreditadas, por lo que si cuenta con clientes para la venta de mi propiedad siempre estará disponible para usted el (la) Sr (a). _______________ para gestionar la correspondiente visita, siempre con su actuación y la suya y respetando el acuerdo que usted tenga con su cliente.</p>
<p>Agradezco de antemano todas sus gestiones realizadas y solicito que sean dadas de baja todas las publicaciones en los portales web que vinculen la comercialización de mi propiedad con su compañía.</p>
<p>Le dejo los datos del (a) Sr (a). _______________ para que podamos seguir siendo aliados comerciales: Celular +569XXXXXXX, correo electrónico: _______________@remax-exclusive.cl.</p>
<p>Sin otro particular, me despido,</p>`
  },
  {
    id: 'orden-visita',
    name: 'Orden de Visita',
    category: 'Visitas',
    subject: 'Orden de visita - (dirección de la propiedad)',
    bodyHtml: `<p>¡Buenas tardes _______________! Junto con saludar y esperando que se encuentre muy bien, le hago llegar adjunta la orden de visita de la propiedad en venta/arriendo ubicada en _______________, comuna de _______________. La visita está pautada para el día _______________ a las _____ hrs.</p>
<p>Agradezco que me responda este correo como confirmación de la visita y lectura de la orden adjunta.</p>
<p>Deseando que tenga un excelente día, quedo a la espera de su respuesta.</p>`
  }
];

export const TEMPLATE_CATEGORIES = [
  ...new Set(EMAIL_TEMPLATES.map(t => t.category))
];
