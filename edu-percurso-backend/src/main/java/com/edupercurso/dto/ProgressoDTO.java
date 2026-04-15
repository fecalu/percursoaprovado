package com.edupercurso.dto;

import com.edupercurso.entity.ProgressoAluno;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

public class ProgressoDTO {

    @Data
    public static class Request {
        @NotNull private UUID percursoId;
        @NotNull
        @Min(0)
        private Integer segundosAssistidos;
        private boolean concluido;
    }

    @Data
    public static class Response {
        private UUID percursoId;
        private String percursoTitulo;
        private Integer segundosAssistidos;
        private Integer duracaoTotal;
        private boolean concluido;
        private LocalDateTime ultimaVez;

        public static Response from(ProgressoAluno p) {
            Response r = new Response();
            r.percursoId = p.getPercurso().getId();
            r.percursoTitulo = p.getPercurso().getTitulo();
            r.segundosAssistidos = p.getSegundosAssistidos() == null ? 0 : p.getSegundosAssistidos();
            r.duracaoTotal = p.getPercurso().getDuracaoSegundos();
            r.concluido = p.isConcluido();
            r.ultimaVez = p.getUltimaVez();
            return r;
        }
    }
}
