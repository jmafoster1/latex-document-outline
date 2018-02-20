{ Disposable } = require 'atom'
fs = require 'fs'
path = require 'path'
chokidar = require 'chokidar'

checkNested = (obj) ->
  args = Array::slice.call(arguments, 1)
  i = 0
  while i < args.length
    if !obj or !obj.hasOwnProperty(args[i])
      return false
    obj = obj[args[i]]
    i++
  true

incrementCounts = (counts, count, structure) ->
  counts[count] += 1
  switch count
    when 'part'
      if checkNested(structure, "parts", counts.part, "chapters")
        structure.parts[counts.part].chapters = structure.parts[counts.part].chapters.slice(0, counts.chapter)
      counts['chapter'] = 0
      counts['section'] = 0
      counts['subsection'] = 0
      counts['subsubsection'] = 0
      break
    when 'chapter'
      if checkNested(structure, "parts", counts.part, "chapters", counts.chapter, "sections")
        structure.parts[counts.part].chapters[counts.chapter].sections = structure.parts[counts.part].chapters[counts.chapter].sections.slice(0, counts.section)
      counts['section'] = 0
      counts['subsection'] = 0
      counts['subsubsection'] = 0
      break
    when 'section'
      if checkNested(structure, "parts", counts.part, "chapters", counts.chapter, "sections", counts.section, "subsections")
        structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections = structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections.slice(0, counts.section)
      counts['subsection'] = 0
      counts['subsubsection'] = 0
      break
    when 'subsection'
      if checkNested(structure, "parts", counts.part, "chapters", counts.chapter, "sections", counts.section, "subsections", counts.subsection, "subsubsections")
        structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections = structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections.slice(0, counts.section)
      counts['subsubsection'] = 0
      break
  return counts

module.exports =
class Manager extends Disposable
  constructor: (latex) ->
    @latex = latex
    @disable_watcher = atom.config.get "atom-latex.disable_watcher"
    @watched = []

  rootDir: ->
    # Collect all open TextEditors with LaTeX grammar
    texEditors = (editor for editor in atom.workspace.getTextEditors()\
                    when editor.getGrammar().scopeName.match(/text.tex.latex/))
    if atom.workspace.getActiveTextEditor() in texEditors # An active TeXeditor is open
      return atom.project.relativizePath(atom.workspace.getActiveTextEditor().getPath())[0]
    else if texEditors.length > 0   # First open editor with LaTeX grammar
      return atom.project.relativizePath(texEditors[0].getPath())[0]
    else # backup, return first active project
        @latex.logger.log.push {
          type: status
          text: "No active TeX editors were open - Setting Project: #{atom.project.getPaths()[0]}"
        }
      return atom.project.getPaths()[0]

  getStructure:(file, structure, counts)->
    text = fs.readFileSync(file, 'utf8')
    inputReg = /(?:\\(?:input|include|subfile)(?:\[[^\[\]\{\}]*\])?){([^}]*)}/
    chapterReg = /(?:\\(part|chapter|section|subsection|subsubsection)(?:\[[^\[\]\{\}]*\])?){([^}]*)}/
    for line, lineNo in text.split(/\r?\n/)
      line = line.trim()
      if line == "" || line.startsWith("%")
        continue
      f = inputReg.exec(line)
      i = chapterReg.exec(line)
      if f
        inputFile = f[1]
        if path.extname(inputFile) == ''
          inputFile += '.tex'
        structure = this.getStructure(path.join(@latex.homeDir,inputFile), structure, counts)
      else if i
        incrementCounts(counts, i[1], structure)

        # parts
        structure.parts = if structure.parts then structure.parts else []
        structure.parts[counts.part] = if structure.parts[counts.part] then structure.parts[counts.part] else {index: "#{counts.part}"}
        # chapters
        if i[1] == 'subsubsection' || i[1] == 'subsection' || i[1] == 'section' || i[1] == 'chapter'
          structure.parts[counts.part].chapters = if structure.parts[counts.part].chapters then structure.parts[counts.part].chapters else []
          structure.parts[counts.part].chapters[counts.chapter] = if structure.parts[counts.part].chapters[counts.chapter] then structure.parts[counts.part].chapters[counts.chapter] else {index: "#{counts.part}-#{counts.chapter}"}
        # sections
        if i[1] == 'subsubsection' || i[1] == 'subsection' || i[1] == 'section'
          structure.parts[counts.part].chapters[counts.chapter].sections = if structure.parts[counts.part].chapters[counts.chapter].sections then structure.parts[counts.part].chapters[counts.chapter].sections else []
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section] = if structure.parts[counts.part].chapters[counts.chapter].sections[counts.section] then structure.parts[counts.part].chapters[counts.chapter].sections[counts.section] else {index: "#{counts.part}-#{counts.chapter}-#{counts.section}"}
        # subsections
        if i[1] == 'subsubsection' || i[1] == 'subsection'
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections = if structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections then structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections else []
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection] = if structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection] then structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection] else {index: "#{counts.part}-#{counts.chapter}-#{counts.section}-#{counts.subsection}"}
        # subsubsections
        if i[1] == 'subsubsection'
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections = if structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections then structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections else []
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections[counts.subsubsection] = if structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections[counts.subsubsection] then structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections[counts.subsubsection] else {index: "#{counts.part}-#{counts.chapter}-#{counts.section}-#{counts.subsection}-#{counts.subsubsection}"}

        if i[1] == 'part'
          structure.parts[counts.part].title = i[2]
          structure.parts[counts.part].file = file
          structure.parts[counts.part].line = lineNo
          structure.parts[counts.part].index = "#{counts.part}"
        if i[1] == 'chapter'
          structure.parts[counts.part].chapters[counts.chapter].title = i[2]
          structure.parts[counts.part].chapters[counts.chapter].file = file
          structure.parts[counts.part].chapters[counts.chapter].line = lineNo
          structure.parts[counts.part].chapters[counts.chapter].index = "#{counts.part}-#{counts.chapter}"
        if i[1] == 'section'
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].title = i[2]
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].file = file
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].line = lineNo
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].index = "#{counts.part}-#{counts.chapter}-#{counts.section}"
        if i[1] == 'subsection'
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].title = i[2]
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].file = file
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].line = lineNo
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].index = "#{counts.part}-#{counts.chapter}-#{counts.section}-#{counts.subsection}"
        if i[1] == 'subsubsection'
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections[counts.subsubsection].title = i[2]
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections[counts.subsubsection].file = file
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections[counts.subsubsection].line = lineNo
          structure.parts[counts.part].chapters[counts.chapter].sections[counts.section].subsections[counts.subsection].subsubsections[counts.subsubsection].index = "#{counts.part}-#{counts.chapter}-#{counts.section}-#{counts.subsection}-#{counts.subsubsection}"
    return structure

  loadLocalCfg: ->
    if @lastCfgTime? and Date.now() - @lastCfgTime < 200 or\
       !atom.workspace.getActiveTextEditor()?
      return @config?
    @lastCfgTime = Date.now()
    rootDir = @rootDir()
    return false if !rootDir?
    if '.latexcfg' in fs.readdirSync rootDir
      try
        filePath = path.join rootDir, '.latexcfg'
        fileContent = fs.readFileSync filePath, 'utf-8'
        @config = JSON.parse fileContent
        if @config.root?
          @config.root = path.resolve rootDir, @config.root
        return true
      catch err
        console.log err
    return false

  isTexFile: (name) ->
    @latex.manager.loadLocalCfg()
    if path.extname(name) in ['.tex','.tikz'] or \
        @latex.manager.config?.latex_ext?.indexOf(path.extname(name)) > -1
      return true
    return false

  findMain: (here) ->
    result = @findMainSequence(here)
    if result and !fs.existsSync(@latex.mainFile)
      @latex.logger.processError(
        "Invalid LaTeX root file `#{path.basename(@latex.mainFile)}`",
        "The path #{@latex.mainFile} does not exist!", true,
        [{
          text: "Set LaTeX root"
          onDidClick: =>
            @latex.manager.refindMain()
            @latex.logger.clearBuildError()
        }])
      return false
    # @latex.panel.view.update()
    return result

  refindMain: () ->
    input = document.getElementById('atom-latex-root-input')
    input.onchange = (=>
      if input.files.length > 0
        @latex.mainFile = input.files[0].path
      # @latex.panel.view.update()
    )
    input.click()

  findMainSequence: (here) ->
    if here
      return true if @findMainSelfMagic()
      return true if @findMainSelf()

    # Check if the mainFile is part of the curent project path
    if @latex.mainFile? and atom.project.relativizePath(@latex.mainFile)[0] == @rootDir()
      return true

    return true if @findMainConfig()
    return true if @findMainSelfMagic()
    return true if @findMainSelf()
    return true if @findMainAllRoot()

    @latex.logger.missingMain()
    return false

  findMainSelf: ->
    docRegex = /\\begin{document}/
    editor = atom.workspace.getActivePaneItem()
    currentPath = editor?.buffer.file?.path
    currentContent = editor?.getText()

    if currentPath and currentContent
      if @isTexFile(currentPath) and currentContent.match(docRegex)
        @latex.mainFile = currentPath
        # @latex.logger.setMain('self')
        return true
    return false

  findMainSelfMagic: ->
    magicRegex = /(?:%\s*!TEX\sroot\s*=\s*([^\s]*\.tex)$)/m
    editor = atom.workspace.getActivePaneItem()
    currentPath = editor?.buffer.file?.path
    currentContent = editor?.getText()

    if currentPath and currentContent
      if @isTexFile(currentPath)
        result = currentContent.match magicRegex
        if result
          @latex.mainFile = path.resolve(path.dirname(currentPath), result[1])
          # @latex.logger.setMain('magic')
          return true
    return false

  findMainConfig: ->
    @loadLocalCfg()
    if @config?.root
      @latex.mainFile = @config.root
      # @latex.logger.setMain('config')
      return true
    return false

  findMainAllRoot: ->
    docRegex = /\\begin{document}/
    for rootDir in atom.project.getPaths()
      for file in fs.readdirSync rootDir
        continue if !@isTexFile(file)
        filePath = path.join rootDir, file
        fileContent = fs.readFileSync filePath, 'utf-8'
        if fileContent.match docRegex
          @latex.mainFile = filePath
          # @latex.logger.setMain('all')
          return true
    return false

  findPDF: ->
    if !@findMain()
      return false
    # mainFile.blah.tex -> mainFile.pdf
    return @latex.mainFile.replace(/\.([^\/]*)$/, '.pdf')

  # prevWatcherClosed: (watcher, watchPath) ->
  #   watchedPaths = watcher.getWatched()
  #   if !( watchPath of watchedPaths)
  #     # rootWatcher exists, but project dir has been changed
  #     # and reset all suggestions and close watcher
  #     @latex.provider.command.resetCommands()
  #     @latex.provider.reference.resetRefItems()
  #     @latex.provider.subFiles.resetFileItems()
  #     @latex.provider.citation.resetBibItems()
  #     watcher.close()
  #     return true
  #   else
  #     return false
  #
  # watchRoot: ->
  #   root = @rootDir()
  #   return false if !root?
  #   if !@rootWatcher? or @prevWatcherClosed(@rootWatcher,root)
  #     @latex.logger.log.push {
  #       type: status
  #       text: "Watching project #{root} for changes"
  #     }
  #     watchFileExts = ['png','eps','jpeg','jpg','pdf','tex','bib']
  #     if @latex.manager.config?.latex_ext?
  #       watchFileExts.push @latex.manager.config.latex_ext...
  #     @rootWatcher = chokidar.watch(root,{
  #       ignored: ///(|[\/\\])\.(?!#{watchFileExts.join("|").replace(/\./g,'')})///g
  #       })
  #     @watched.push(root)
  #     console.time('RootWatcher Init')
  #     @rootWatcher.on('add',(fpath)=>
  #       @watchActions(fpath,'add')
  #       return)
  #     @rootWatcher.on('ready',
  #     () =>
  #       @rootWatcher.on('change', (fpath,stats) =>
  #         if @isTexFile(fpath)
  #           if fpath == @latex.mainFile
  #             # Update dependent files
  #             @latex.texFiles = [ @latex.mainFile ]
  #             @latex.bibFiles = []
  #             @findDependentFiles(@latex.mainFile)
  #           @watchActions(fpath)
  #         return)
  #       @rootWatcher.on('unlink',(fpath) =>
  #         @watchActions(fpath,'unlink')
  #         return)
  #     )
  #     console.timeEnd('RootWatcher Init')
  #     return true
  #
  #   return false
  #
  # watchActions: (fpath,event) ->
  #   # Push/Splice file suggestions on new file additions or removals
  #   if event is 'add'
  #     @latex.provider.subFiles.getFileItems(fpath)
  #   else if event is 'unlink'
  #     @latex.provider.subFiles. resetFileItems(fpath)
  #     @latex.provider.reference.resetRefItems(fpath)
  #   if @isTexFile(fpath)
  #     # Push command and references suggestions
  #     @latex.provider.command.getCommands(fpath)
  #     @latex.provider.reference.getRefItems(fpath)
  #
  # findAll: ->
  #   if !@findMain()
  #     return false
  #   if @disable_watcher or @watchRoot()
  #     @latex.texFiles = [ @latex.mainFile ]
  #     @latex.bibFiles = []
  #     @findDependentFiles(@latex.mainFile)
  #     if @disable_watcher
  #       @watchActions(file,'add') for file in @latex.texFiles
  #   return true
  #
  # findDependentFiles: (file) ->
  #   content = fs.readFileSync file, 'utf-8'
  #   baseDir = path.dirname(@latex.mainFile)
  #
  #   inputReg = /(?:\\(?:input|include|subfile)(?:\[[^\[\]\{\}]*\])?){([^}]*)}/g
  #   loop
  #     result = inputReg.exec content
  #     break if !result?
  #     inputFile = result[1]
  #     if path.extname(inputFile) is ''
  #       inputFile += '.tex'
  #     filePath = path.resolve(path.join(baseDir, inputFile))
  #     if @latex.texFiles.indexOf(filePath) < 0 and fs.existsSync(filePath)
  #       @latex.texFiles.push(filePath)
  #       @findDependentFiles(filePath)
  #
  #   bibReg = /(?:\\(?:bibliography|addbibresource)(?:\[[^\[\]\{\}]*\])?){(.+?)}/g
  #   loop
  #     result = bibReg.exec content
  #     break if !result?
  #     bibs = result[1].split(',').map((bib) -> bib.trim())
  #     @addBibToWatcher(bib) for bib in bibs
  #
  #   # Reset Citations
  #   for fpath in @watched
  #     # The race is on b/w this test and setting up bibWatcher, hence the first check
  #     if fpath? and fpath not in @latex.bibFiles and !(fpath.indexOf('.bib') < 0)
  #       # bib file removed, remove citation suggestions and unwatch
  #       @latex.provider.citation.resetBibItems(fpath)
  #       @bibWatcher.unwatch(fpath)
  #       @watched.splice(@watched.indexOf(fpath),1)
  #   return true
  #
  # addBibToWatcher: (bib) ->
  #   if path.extname(bib) is ''
  #     bib += '.bib'
  #   bib = path.resolve(path.join(path.dirname(@latex.mainFile),bib))
  #   if @latex.bibFiles.indexOf(bib) < 0
  #     @latex.bibFiles.push(bib)
  #   if @disable_watcher
  #     @latex.provider.citation.getBibItems(bib)
  #     return
  #   # Init bibWatcher listeners
  #   if !@bibWatcher? or @bibWatcher.closed
  #     @bibWatcher = chokidar.watch(bib)
  #     @watched.push(bib)
  #     # @latex.logger.log.push {
  #     #   type: status
  #     #   text: "Watching bib file #{bib} for changes"
  #     # }
  #     # Register watcher callbacks
  #     @bibWatcher.on('add', (fpath) =>
  #       # bib file added, parse
  #       @latex.provider.citation.getBibItems(fpath)
  #       # @latex.logger.log.push {
  #       #   type: status
  #       #   text: "Added bib file #{fpath} to Watcher"
  #       # }
  #       return)
  #     @bibWatcher.on('change', (fpath) =>
  #       # bib file changed, reparse
  #       @latex.provider.citation.getBibItems(fpath)
  #       return)
  #     @bibWatcher.on('unlink', (fpath) =>
  #       # bib file deleted, remove citation suggestions and unwatch
  #       @latex.provider.citation.resetBibItems(fpath)
  #       @bibWatcher.unwatch(fpath)
  #       @watched.splice(@watched.indexOf(fpath),1)
  #       return)
  #   else if bib not in @watched
  #     # Process new unwatched bib file
  #     @bibWatcher.add(bib)
  #     @watched.push(bib)
