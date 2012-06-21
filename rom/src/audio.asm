; '2600 for Newbies
; Session 21 - Sprites
; This kernel draws a simple box around the screen border
; Introduces sprites


                processor 6502
                include "vcs.h"
                include "macro.h"


    SEG.U vars
    ORG $80
var1    ds 1


FREQUENCY     = $AA


;------------------------------------------------------------------------------

                SEG code
                ORG $F000

Reset

    ; Clear RAM and all TIA registers

                sei

                ldx #0 
                lda #0 
Clear           sta 0,x 
                inx 
                bne Clear

StartOfFrame

    ; Start of new frame
    ; Start of vertical blank processing

                lda #0
                sta VBLANK

                lda #2
                sta VSYNC

                sta WSYNC
                sta WSYNC
                sta WSYNC                ; 3 scanlines of VSYNC signal

                lda #0
                sta VSYNC
                
                lda #$0B
                sta AUDC0
                
;                lda #%00011101

                lda FREQUENCY
                dec FREQUENCY
                sta AUDF0

                lda #$FF
                sta AUDV0

        ;------------------------------------------------
        ; 37 scanlines of vertical blank...
            
                ldx #0
VerticalBlank   sta WSYNC
                inx
                cpx #37
                bne VerticalBlank

        ;------------------------------------------------
        ; Do 192 scanlines of colour-changing (our picture)

                ldx #0                  ; this counts our scanline number

Scanline        sta WSYNC
                inx
                cpx #192
                bne Scanline

        ;------------------------------------------------

 
                lda #%01000010
                sta VBLANK           ; end of screen - enter blanking

    ; 30 scanlines of overscan...

                ldx #0
Overscan        sta WSYNC
                inx
                cpx #30
                bne Overscan

                jmp StartOfFrame


;------------------------------------------------------------------------------

            ORG $FFFA

InterruptVectors

            .word Reset           ; NMI
            .word Reset           ; RESET
            .word Reset           ; IRQ

    		END

