module t; genvar i; 
  generate for (i=0;i<200000;i=i+1) begin: g wire x = i[0]; end endgenerate
  initial $display("done");
endmodule
