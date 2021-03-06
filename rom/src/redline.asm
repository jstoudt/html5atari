; thin red line by Kirk Israel

	processor 6502
	include vcs.h
	org $F000


Start
	sei
	cld
	ldx #$FF
	txs
	lda #0

ClearMem
	sta 0,X
	dex
	bne ClearMem
	lda #$00
	sta COLUBK
	lda #33
	sta COLUP0

MainLoop
	lda  #2
	sta  VSYNC
	sta  WSYNC
	sta  WSYNC
	sta  WSYNC
	lda  #43
	sta  TIM64T
	lda #0
	sta  VSYNC

WaitForVblankEnd
	lda INTIM
	bne WaitForVblankEnd
	ldy #191

	sta WSYNC
	sta VBLANK
	lda #$F0
	sta HMM0

	sta WSYNC
	sta HMOVE

ScanLoop
	sta WSYNC
	lda #2
	sta ENAM0
	dey
	bne ScanLoop

	lda #2
	sta WSYNC
	sta VBLANK
	ldx #30
	
OverScanWait
	sta WSYNC
	dex
	bne OverScanWait
	jmp  MainLoop

	org $FFFC
	.word Start
	.word Start