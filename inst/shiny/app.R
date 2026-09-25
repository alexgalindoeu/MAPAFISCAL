# =============================================================================
# irpfsim :: dashboard interactivo (Shiny)
# =============================================================================
# Arranque:
#   "C:/Program Files/R/R-4.3.3/bin/Rscript.exe" -e "shiny::runApp('inst/shiny', port=7000, launch.browser=TRUE)"
# =============================================================================

library(shiny)
if (!exists("liquidar")) {
  .raiz <- Sys.getenv("IRPFSIM_ROOT", "")
  if (!nzchar(.raiz)) for (cand in c(".", "..", "../..", "../../.."))
    if (dir.exists(file.path(cand, "R")) && dir.exists(file.path(cand, "params"))) { .raiz <- normalizePath(cand); break }
  source(file.path(.raiz, "R", "cargar.R")); irpfsim_cargar(.raiz)
}

NOMBRES <- c(
  "ES-AN"="Andalucía","ES-AR"="Aragón","ES-AS"="Asturias","ES-IB"="Illes Balears",
  "ES-CN"="Canarias","ES-CB"="Cantabria","ES-CM"="Castilla-La Mancha","ES-CL"="Castilla y León",
  "ES-CT"="Cataluña","ES-EX"="Extremadura","ES-GA"="Galicia","ES-MD"="Madrid",
  "ES-MC"="Murcia","ES-RI"="La Rioja","ES-VC"="C. Valenciana",
  "ES-PV-BI"="Bizkaia","ES-PV-SS"="Gipuzkoa","ES-PV-VI"="Araba","ES-NC"="Navarra")

ui <- fluidPage(
  titlePanel("irpfsim — Microsimulador del IRPF español"),
  tabsetPanel(
    tabPanel("Comparador de perfiles",
      sidebarLayout(
        sidebarPanel(
          numericInput("p_trabajo", "Rendimientos del trabajo (íntegros, €)", 35000, 0, step = 1000),
          numericInput("p_ss", "Cotizaciones a la Seguridad Social (€)", 2222, 0, step = 100),
          numericInput("p_ahorro", "Rendimientos del capital / ahorro (€)", 0, 0, step = 500),
          numericInput("p_edad", "Edad del contribuyente", 40, 18, 100),
          selectInput("p_uf", "Unidad familiar", c("ninguna","biparental","monoparental")),
          numericInput("p_hijos", "Nº de descendientes", 0, 0, 6),
          checkboxGroupInput("p_terr", "Territorios a comparar",
            choices = setNames(names(NOMBRES), NOMBRES),
            selected = c("ES-MD","ES-CT","ES-AN","ES-PV-BI","ES-NC")),
          actionButton("go_comp", "Comparar", class = "btn-primary")
        ),
        mainPanel(
          plotOutput("plot_comp", height = "380px"),
          tableOutput("tab_comp")
        )
      )
    ),
    tabPanel("Simulador de reformas",
      sidebarLayout(
        sidebarPanel(
          checkboxGroupInput("s_terr", "Territorios de la muestra",
            choices = setNames(names(NOMBRES), NOMBRES),
            selected = c("ES-MD","ES-CT","ES-AN","ES-PV-BI","ES-NC")),
          numericInput("s_n", "Hogares sintéticos por territorio", 400, 50, 3000, step = 50),
          tags$hr(),
          tags$b("Parámetros de reforma (estatal)"),
          sliderInput("r_min", "Mínimo del contribuyente (€)", 3000, 9000, 5550, step = 50),
          sliderInput("r_t3", "Tipo marginal estatal tramo 20.200–35.200 € (%)", 10, 25, 15, step = 0.5),
          sliderInput("r_t6", "Tipo marginal estatal > 300.000 € (%)", 20, 35, 24.5, step = 0.5),
          sliderInput("r_ah3", "Tipo del ahorro > 200.000 € (parte estatal, %)", 9, 20, 11.5, step = 0.5),
          actionButton("go_sim", "Simular", class = "btn-primary")
        ),
        mainPanel(
          verbatimTextOutput("sim_resumen"),
          plotOutput("sim_decil", height = "340px"),
          tableOutput("sim_tabla")
        )
      )
    ),
    tabPanel("Cobertura de parámetros",
      br(), htmlOutput("cobertura")
    )
  )
)

server <- function(input, output, session) {

  construir_hogar <- function(terr) {
    miembros <- list(persona("d1","declarante", input$p_edad,
      trabajo = list(dinerarias = input$p_trabajo, cotizaciones_ss = input$p_ss),
      capital_mobiliario = list(intereses = input$p_ahorro)))
    for (i in seq_len(input$p_hijos))
      miembros <- c(miembros, list(persona(paste0("h",i), "descendiente", 6)))
    nuevo_hogar("perfil", terr, miembros, 2025,
      tipo_unidad_familiar = input$p_uf,
      familia_numerosa = if (input$p_hijos >= 4) "especial" else if (input$p_hijos == 3) "general" else "no")
  }

  comp <- eventReactive(input$go_comp, {
    limpiar_avisos()
    do.call(rbind, lapply(input$p_terr, function(t) {
      liq <- tryCatch(liquidar(construir_hogar(t), modo = "auto"), error = function(e) NULL)
      if (is.null(liq)) return(NULL)
      data.frame(territorio = NOMBRES[[t]],
                 cuota = liq$cuota_resultante_autoliquidacion,
                 tipo_efectivo = 100 * liq$tipo_medio_efectivo,
                 modo = liq$modo_tributacion_elegido)
    }))
  })

  output$plot_comp <- renderPlot({
    d <- comp(); req(d)
    d <- d[order(d$cuota), ]
    par(mar = c(4, 8, 2, 1))
    barplot(rev(d$cuota), horiz = TRUE, names.arg = rev(d$territorio), las = 1,
            col = "#3b6ea5", xlab = "Cuota líquida total (€)",
            main = "Carga fiscal del mismo perfil por territorio")
  })
  output$tab_comp <- renderTable(comp(), digits = 2)

  sim <- eventReactive(input$go_sim, {
    limpiar_avisos()
    rf <- reforma(
      list(territorio = "estatal", ruta = "minimo_contribuyente/general", valor = input$r_min),
      parche_tipo_tramo("estatal","escala_general_estatal", 3, input$r_t3/100),
      parche_tipo_tramo("estatal","escala_general_estatal", 6, input$r_t6/100),
      list(territorio = "estatal", ruta = "escala_ahorro_estatal/tramos/3/tipo", valor = input$r_ah3/100)
    )
    m <- generar_muestra(n_por_territorio = input$s_n, territorios = input$s_terr, semilla = 1)
    simular(m, rf)
  })

  output$sim_resumen <- renderPrint({ print(sim()) })

  output$sim_decil <- renderPlot({
    s <- sim(); req(s)
    b <- s$impacto$por_decil_base; r <- s$impacto$por_decil_reforma
    delta <- r$renta_disponible_media - b$renta_disponible_media
    par(mar = c(4,4,2,1))
    barplot(delta, names.arg = 1:length(delta), col = ifelse(delta >= 0, "#2e7d32", "#c62828"),
            xlab = "Decil de renta bruta", ylab = "Δ renta disponible media (€)",
            main = "Efecto de la reforma por decil")
    abline(h = 0)
  })

  output$sim_tabla <- renderTable({
    s <- sim(); req(s)
    b <- s$impacto$por_decil_base
    data.frame(decil = b$decil,
               renta_bruta_media = round(b$renta_bruta_media),
               tipo_efectivo_base = round(100*b$tipo_efectivo_medio, 2),
               tipo_efectivo_reforma = round(100*s$impacto$por_decil_reforma$tipo_efectivo_medio, 2))
  }, digits = 2)

  output$cobertura <- renderUI({
    HTML(paste0(
      "<h4>Estado de la parametrización (ejercicio 2025)</h4><ul>",
      "<li><b>Escalas general y del ahorro</b>: estatal + 17 CCAA + 3 TH vascos + Navarra — <b>verificadas</b> (AEAT / boletines forales).</li>",
      "<li><b>Mínimos y reducciones estatales</b>: cargados (art. 20, mínimos, tributación conjunta, DT 9ª).</li>",
      "<li><b>Deducciones autonómicas</b> (17 CCAA): <b>pendientes</b> — el motor aplica solo la escala.</li>",
      "<li><b>Deducciones forales PV</b>: bonificación del trabajo, minoración de cuota y familiares — cargadas (Gipuzkoa); Bizkaia/Araba provisional.</li>",
      "<li><b>Navarra</b>: escalas cargadas; mínimos familiares, vivienda y reducción del trabajo <b>pendientes</b>.</li>",
      "<li><b>Estimación objetiva (módulos)</b>: pendiente (entra como rendimiento exógeno).</li>",
      "<li><b>Muestra sintética</b>: calibración con objetivos <b>provisionales</b> (sustituir por Estadística de declarantes IRPF de la AEAT y boletines forales).</li>",
      "</ul><p>Ver <code>docs/00_documento_diseno.md</code> y <code>docs/02_cobertura.md</code>.</p>"))
  })
}

shinyApp(ui, server)
