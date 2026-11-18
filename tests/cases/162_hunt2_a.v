module t;
  function automatic integer f(input integer n);
    begin : fb
      integer v;
      v = n;
      if (n > 0) f = f(n-1); else f = 0;
      f = f + v;
    end
  endfunction
  initial $display("%0d", f(4));
endmodule
